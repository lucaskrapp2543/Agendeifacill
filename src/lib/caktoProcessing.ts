/**
 * Venda pela Cakto: o que acontece no banco quando chega um aviso e quando o cliente
 * cria a conta em /cadastrar. Roda SÓ no servidor (funções Netlify), com a chave de serviço.
 *
 * REGRA DE SEGURANÇA: este arquivo só mexe em barbearias que nasceram por aqui
 * (ligadas em `cakto_orders.establishment_id`). Nenhuma conta antiga é tocada.
 *
 * A criação da conta usa os MESMOS campos do cadastro pago atual
 * (src/lib/siteRegistrationCheckoutConversion.ts). Se um campo novo for exigido lá, repetir aqui.
 */
import { CAKTO_PAYMENT_PROVIDER, CAKTO_PLANO, CAKTO_PRODUCT_ID, caktoPaymentId } from './caktoConfig';
import { classificarAvisoCakto, emailValido, lerAvisoCakto, normalizarEmail, type CaktoOrder } from './caktoPayload';
import { gravarServicosDaContaPronta, montarContaPronta } from './contaPronta';

const defaultBusinessHours = {
  monday: { enabled: true, open1: '08:00', close1: '18:00', open2: null, close2: null },
  tuesday: { enabled: true, open1: '08:00', close1: '18:00', open2: null, close2: null },
  wednesday: { enabled: true, open1: '08:00', close1: '18:00', open2: null, close2: null },
  thursday: { enabled: true, open1: '08:00', close1: '18:00', open2: null, close2: null },
  friday: { enabled: true, open1: '08:00', close1: '18:00', open2: null, close2: null },
  saturday: { enabled: true, open1: '08:00', close1: '18:00', open2: null, close2: null },
  sunday: { enabled: false, open1: null, close1: null, open2: null, close2: null },
};

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Vencimento = 1 mês depois do pagamento, no calendário de Brasília.
 * Dia 31 em mês de 30 dias vira dia 30 (não pula para o mês seguinte).
 */
export function proximoVencimentoCakto(paidAtIso?: string | null, agora: Date = new Date()): string {
  let base = paidAtIso ? new Date(paidAtIso) : agora;
  if (Number.isNaN(base.getTime())) base = agora;
  const br = new Date(base.getTime() - 3 * 60 * 60 * 1000);
  const alvo = new Date(Date.UTC(br.getUTCFullYear(), br.getUTCMonth() + 1, 1));
  const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  const dia = Math.min(br.getUTCDate(), ultimoDia);
  return `${alvo.getUTCFullYear()}-${pad2(alvo.getUTCMonth() + 1)}-${pad2(dia)}`;
}

const maiorData = (a: string, b: unknown): string => {
  const atual = String(b || '').slice(0, 10);
  return atual && atual > a ? atual : a;
};

async function gerarCodigoUnico(supabaseAdmin: any): Promise<string> {
  for (let tentativa = 0; tentativa < 10; tentativa += 1) {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const { data } = await supabaseAdmin.from('establishments').select('id').eq('code', code).maybeSingle();
    if (!data?.id) return code;
  }
  return `${Date.now()}`.slice(-6);
}

const ehDuplicado = (error: any) => String(error?.code || '') === '23505';

async function buscarPedido(supabaseAdmin: any, orderId: string): Promise<any | null> {
  const { data, error } = await supabaseAdmin.from('cakto_orders').select('*').eq('cakto_order_id', orderId).maybeSingle();
  if (error) throw new Error(`Falha ao consultar cakto_orders: ${error.message}`);
  return data || null;
}

/** Linha de pedido que já virou conta: primeiro pela assinatura, depois pelo e-mail. */
async function buscarConta(
  supabaseAdmin: any,
  order: CaktoOrder
): Promise<{ row: any; por: 'assinatura' | 'email' } | null> {
  if (order.subscriptionId) {
    const { data, error } = await supabaseAdmin
      .from('cakto_orders')
      .select('*')
      .eq('subscription_id', order.subscriptionId)
      .not('establishment_id', 'is', null)
      .order('used_at', { ascending: false })
      .limit(1);
    if (error) throw new Error(`Falha ao consultar conta pela assinatura: ${error.message}`);
    if (data?.[0]) return { row: data[0], por: 'assinatura' };
  }
  const { data, error } = await supabaseAdmin
    .from('cakto_orders')
    .select('*')
    .eq('email', order.email)
    .not('establishment_id', 'is', null)
    .order('used_at', { ascending: false })
    .limit(1);
  if (error) throw new Error(`Falha ao consultar conta pelo e-mail: ${error.message}`);
  return data?.[0] ? { row: data[0], por: 'email' } : null;
}

/** Pagamento ainda sem conta do mesmo cliente (ele pagou e não se cadastrou). */
async function buscarCompraSemConta(supabaseAdmin: any, order: CaktoOrder): Promise<any | null> {
  let query = supabaseAdmin
    .from('cakto_orders')
    .select('id')
    .eq('kind', 'signup')
    .eq('status', 'paid')
    .is('used_at', null);
  query = order.subscriptionId ? query.eq('subscription_id', order.subscriptionId) : query.eq('email', order.email);
  const { data, error } = await query.limit(1);
  if (error) throw new Error(`Falha ao consultar compra sem conta: ${error.message}`);
  return data?.[0] || null;
}

const linhaBase = (order: CaktoOrder, event: string, nowIso: string) => ({
  cakto_order_id: order.id,
  ref_id: order.refId || null,
  status: 'paid',
  email: order.email,
  customer_name: order.customerName || null,
  customer_phone: order.customerPhone || null,
  customer_doc: order.customerDoc || null,
  amount_cents: order.amountCents > 0 ? order.amountCents : CAKTO_PLANO.amountCents,
  payment_method: order.paymentMethod || null,
  product_id: order.productId || null,
  offer_id: order.offerId || null,
  subscription_id: order.subscriptionId || null,
  subscription_period: order.subscriptionPeriod,
  subscription_status: 'active',
  paid_at: order.paidAt || nowIso,
  last_event: event,
  updated_at: nowIso,
});

/**
 * Lança o pagamento no histórico da barbearia e empurra o vencimento.
 * Mesma regularização que o pagamento pelo Mercado Pago já faz hoje
 * (netlify/functions/mercadopago-webhook.ts): paga, desbloqueia e tira o alerta.
 */
async function lancarPagamentoNaConta(
  supabaseAdmin: any,
  establishmentId: string,
  pedido: {
    cakto_order_id: string;
    ref_id?: string | null;
    amount_cents: number;
    payment_method?: string | null;
    subscription_id?: string | null;
    subscription_period?: number | null;
    paid_at?: string | null;
  },
  nowIso: string
): Promise<boolean> {
  const paymentId = caktoPaymentId(pedido.cakto_order_id);
  const { data: jaTem } = await supabaseAdmin
    .from('establishment_billing_payments')
    .select('id,status')
    .eq('payment_id', paymentId)
    .maybeSingle();
  if (jaTem?.status === 'paid') return false; // já contado: não empurra o vencimento duas vezes

  const { error: pagamentoError } = await supabaseAdmin.from('establishment_billing_payments').upsert(
    {
      establishment_id: establishmentId,
      amount_cents: pedido.amount_cents > 0 ? pedido.amount_cents : CAKTO_PLANO.amountCents,
      payment_provider: CAKTO_PAYMENT_PROVIDER,
      payment_id: paymentId,
      status: 'paid',
      description: `Mensalidade Cakto plano ${CAKTO_PLANO.label}`,
      metadata: {
        type: 'cakto_subscription',
        cakto_order_id: pedido.cakto_order_id,
        cakto_ref_id: pedido.ref_id || null,
        subscription_id: pedido.subscription_id || null,
        subscription_period: pedido.subscription_period ?? null,
        payment_method: pedido.payment_method || null,
        selected_plan: CAKTO_PLANO.key,
      },
      paid_at: pedido.paid_at || nowIso,
      updated_at: nowIso,
    } as any,
    { onConflict: 'payment_id' }
  );
  if (pagamentoError) throw new Error(`Falha ao lançar pagamento: ${pagamentoError.message}`);

  const { data: est, error: estError } = await supabaseAdmin
    .from('establishments')
    .select('id,payment_due_date')
    .eq('id', establishmentId)
    .maybeSingle();
  if (estError || !est) throw new Error(`Barbearia não encontrada para regularizar: ${estError?.message || establishmentId}`);

  // Nunca encurta: se o vencimento atual já está mais à frente, ele fica.
  const vencimento = maiorData(proximoVencimentoCakto(pedido.paid_at), (est as any).payment_due_date);
  const { error: updateError } = await supabaseAdmin
    .from('establishments')
    .update({
      payment_status: 'paid',
      is_blocked: false,
      is_deleted: false,
      payment_alert_enabled: false,
      payment_paid_at: pedido.paid_at || nowIso,
      payment_due_date: vencimento,
    } as any)
    .eq('id', establishmentId);
  if (updateError) throw new Error(`Falha ao regularizar barbearia: ${updateError.message}`);
  return true;
}

async function tratarPagamento(supabaseAdmin: any, order: CaktoOrder, event: string, nowIso: string): Promise<string> {
  const existente = await buscarPedido(supabaseAdmin, order.id);
  if (existente) {
    await supabaseAdmin.from('cakto_orders').update({ last_event: event, updated_at: nowIso }).eq('id', existente.id);
    return 'repetido';
  }
  if (!emailValido(order.email)) return 'sem_email';

  const base = linhaBase(order, event, nowIso);
  const conta = await buscarConta(supabaseAdmin, order);

  if (conta) {
    const pareceRenovacao =
      conta.por === 'assinatura' || event === 'subscription_renewed' || (order.subscriptionPeriod ?? 0) > 1;
    if (!pareceRenovacao) {
      // Cliente que já tem conta comprou de novo: não mexe sozinho na conta. Vai para o admin resolver.
      const { error } = await supabaseAdmin.from('cakto_orders').insert({
        ...base,
        kind: 'signup',
        needs_attention: true,
        attention_reason: 'cliente_ja_tem_conta',
      } as any);
      if (error) {
        if (ehDuplicado(error)) return 'repetido';
        throw new Error(`Falha ao gravar pedido: ${error.message}`);
      }
      return 'atencao_cliente_ja_tem_conta';
    }

    const { error } = await supabaseAdmin.from('cakto_orders').insert({
      ...base,
      kind: 'renewal',
      used_at: nowIso,
      owner_id: conta.row.owner_id || null,
      establishment_id: conta.row.establishment_id,
    } as any);
    if (error) {
      if (ehDuplicado(error)) return 'repetido';
      throw new Error(`Falha ao gravar renovação: ${error.message}`);
    }
    await lancarPagamentoNaConta(supabaseAdmin, String(conta.row.establishment_id), base, nowIso);
    return 'renovacao_aplicada';
  }

  // Pagou de novo antes de criar a conta: guarda como renovação; entra na conta quando ele se cadastrar.
  const compraSemConta = await buscarCompraSemConta(supabaseAdmin, order);

  // Renovação de uma assinatura que o sistema nunca viu nascer (cliente que já assinava
  // pela Cakto antes deste fluxo existir). NÃO vira crédito de conta nova e não mexe em
  // conta nenhuma: fica marcada para o admin, que continua cuidando desse cliente como hoje.
  const ehRenovacao = event === 'subscription_renewed' || (order.subscriptionPeriod ?? 0) > 1;
  if (!compraSemConta && ehRenovacao) {
    const { error: antigaError } = await supabaseAdmin.from('cakto_orders').insert({
      ...base,
      kind: 'renewal',
      needs_attention: true,
      attention_reason: 'renovacao_sem_conta',
    } as any);
    if (antigaError) {
      if (ehDuplicado(antigaError)) return 'repetido';
      throw new Error(`Falha ao gravar renovação antiga: ${antigaError.message}`);
    }
    return 'atencao_renovacao_sem_conta';
  }

  const { error } = await supabaseAdmin
    .from('cakto_orders')
    .insert({ ...base, kind: compraSemConta ? 'renewal' : 'signup' } as any);
  if (error) {
    if (ehDuplicado(error)) return 'repetido';
    throw new Error(`Falha ao gravar pedido: ${error.message}`);
  }
  return compraSemConta ? 'renovacao_aguardando_cadastro' : 'pagamento_registrado';
}

async function tratarEstorno(
  supabaseAdmin: any,
  order: CaktoOrder,
  tipo: 'refunded' | 'chargeback',
  event: string,
  nowIso: string
): Promise<string> {
  const pedido = await buscarPedido(supabaseAdmin, order.id);
  if (!pedido) return 'estorno_de_pedido_desconhecido';
  if (pedido.status === tipo) return 'repetido';

  const { error } = await supabaseAdmin
    .from('cakto_orders')
    .update({
      status: tipo,
      refunded_at: order.refundedAt || nowIso,
      needs_attention: true,
      attention_reason: tipo === 'chargeback' ? 'contestacao' : 'reembolso',
      last_event: event,
      updated_at: nowIso,
    } as any)
    .eq('id', pedido.id);
  if (error) throw new Error(`Falha ao marcar estorno: ${error.message}`);

  if (!pedido.establishment_id) return 'estorno_registrado_sem_conta';

  await supabaseAdmin
    .from('establishment_billing_payments')
    .update({ status: 'refunded', updated_at: nowIso } as any)
    .eq('payment_id', caktoPaymentId(order.id))
    .eq('establishment_id', pedido.establishment_id);

  // Só bloqueia se o dinheiro devolvido for do mês em vigor. Se existe um pagamento
  // mais novo e válido, a conta continua paga e o caso fica marcado para o admin.
  const { data: maisNovos, error: maisNovosError } = await supabaseAdmin
    .from('cakto_orders')
    .select('id')
    .eq('establishment_id', pedido.establishment_id)
    .eq('status', 'paid')
    .gt('paid_at', pedido.paid_at || nowIso)
    .limit(1);
  if (maisNovosError) throw new Error(`Falha ao conferir pagamentos mais novos: ${maisNovosError.message}`);
  if (maisNovos && maisNovos.length > 0) return 'estorno_registrado_conta_segue_paga';

  const { error: bloqueioError } = await supabaseAdmin
    .from('establishments')
    .update({ is_blocked: true } as any)
    .eq('id', pedido.establishment_id);
  if (bloqueioError) throw new Error(`Falha ao bloquear conta: ${bloqueioError.message}`);
  return 'estorno_conta_bloqueada';
}

async function tratarCancelamento(supabaseAdmin: any, order: CaktoOrder, event: string, nowIso: string): Promise<string> {
  // Cancelar a assinatura NÃO bloqueia: a conta segue até o vencimento, como qualquer outra.
  const mudanca = { subscription_status: 'canceled', last_event: event, updated_at: nowIso } as any;
  const query = supabaseAdmin.from('cakto_orders').update(mudanca);
  const { error } = order.subscriptionId
    ? await query.eq('subscription_id', order.subscriptionId)
    : await query.eq('cakto_order_id', order.id);
  if (error) throw new Error(`Falha ao marcar cancelamento: ${error.message}`);
  return 'assinatura_cancelada';
}

async function tratarAtencao(supabaseAdmin: any, order: CaktoOrder, event: string, nowIso: string): Promise<string> {
  const { error } = await supabaseAdmin
    .from('cakto_orders')
    .update({
      needs_attention: true,
      attention_reason: event === 'refund_requested' ? 'reembolso_solicitado' : 'contestacao_aberta',
      last_event: event,
      updated_at: nowIso,
    } as any)
    .eq('cakto_order_id', order.id);
  if (error) throw new Error(`Falha ao marcar atenção: ${error.message}`);
  return 'marcado_para_atencao';
}

export interface ResultadoAvisoCakto {
  event: string;
  resultados: Array<{ orderId: string; acao: string; resultado: string }>;
}

/** Processa um aviso JÁ CONFERIDO (segredo validado antes de chamar). */
export async function processarAvisoCakto(
  supabaseAdmin: any,
  corpo: any,
  opcoes?: { productId?: string; agora?: Date }
): Promise<ResultadoAvisoCakto> {
  const productId = String(opcoes?.productId || CAKTO_PRODUCT_ID).trim();
  const nowIso = (opcoes?.agora || new Date()).toISOString();
  const { event, orders } = lerAvisoCakto(corpo);
  const resultados: ResultadoAvisoCakto['resultados'] = [];

  for (const order of orders) {
    const acao = classificarAvisoCakto(event, order.status);
    let resultado = 'ignorado';
    if (order.productId !== productId) {
      resultado = 'produto_ignorado';
    } else if (acao === 'paid') {
      resultado = await tratarPagamento(supabaseAdmin, order, event, nowIso);
    } else if (acao === 'refunded' || acao === 'chargeback') {
      resultado = await tratarEstorno(supabaseAdmin, order, acao, event, nowIso);
    } else if (acao === 'subscription_canceled') {
      resultado = await tratarCancelamento(supabaseAdmin, order, event, nowIso);
    } else if (acao === 'attention') {
      resultado = await tratarAtencao(supabaseAdmin, order, event, nowIso);
    }
    resultados.push({ orderId: order.id, acao, resultado });
  }
  return { event, resultados };
}

// ───────────────────────── criação da conta em /cadastrar ─────────────────────────

export type CodigoCadastroCakto =
  | 'ok'
  | 'pagamento_nao_encontrado'
  | 'pagamento_ja_usado'
  | 'pagamento_estornado'
  | 'email_ja_tem_conta'
  | 'em_andamento'
  | 'erro';

export interface ResultadoCadastroCakto {
  ok: boolean;
  code: CodigoCadastroCakto;
  establishmentCode?: string;
  establishmentId?: string;
  userId?: string;
  detalhe?: string;
}

export async function criarContaComPagamentoCakto(
  supabaseAdmin: any,
  input: {
    email: string;
    password: string;
    establishmentName: string;
    /** Código do país + número, só dígitos. */
    whatsapp: string;
    ip?: string | null;
    userAgent?: string | null;
    agora?: Date;
  }
): Promise<ResultadoCadastroCakto> {
  const email = normalizarEmail(input.email);
  const nowIso = (input.agora || new Date()).toISOString();
  const establishmentName = String(input.establishmentName || '').trim();

  const { data: compras, error: comprasError } = await supabaseAdmin
    .from('cakto_orders')
    .select('*')
    .eq('email', email)
    .eq('kind', 'signup')
    .order('paid_at', { ascending: true });
  if (comprasError) return { ok: false, code: 'erro', detalhe: comprasError.message };

  const lista: any[] = Array.isArray(compras) ? compras : [];
  if (lista.length === 0) return { ok: false, code: 'pagamento_nao_encontrado' };

  const livre = lista.find((c) => c.status === 'paid' && !c.used_at && !c.needs_attention);
  if (!livre) {
    if (lista.some((c) => c.status === 'paid' && !c.used_at && c.needs_attention)) {
      return { ok: false, code: 'email_ja_tem_conta' };
    }
    if (lista.some((c) => c.used_at)) return { ok: false, code: 'pagamento_ja_usado' };
    return { ok: false, code: 'pagamento_estornado' };
  }

  // Reserva o pagamento ANTES de criar qualquer coisa: dois cliques não viram duas contas.
  const { data: reservado, error: reservaError } = await supabaseAdmin
    .from('cakto_orders')
    .update({ used_at: nowIso, updated_at: nowIso } as any)
    .eq('id', livre.id)
    .is('used_at', null)
    .select('id');
  if (reservaError) return { ok: false, code: 'erro', detalhe: reservaError.message };
  if (!reservado || reservado.length === 0) return { ok: false, code: 'em_andamento' };

  const soltarReserva = async (extra?: Record<string, unknown>) => {
    await supabaseAdmin
      .from('cakto_orders')
      .update({ used_at: null, updated_at: new Date().toISOString(), ...(extra || {}) } as any)
      .eq('id', livre.id);
  };

  const ownerName = String(livre.customer_name || '').trim() || establishmentName;
  let userId = '';
  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true, // o pagamento é a confirmação
      user_metadata: {
        role: 'establishment',
        full_name: ownerName,
        establishment_name: establishmentName,
        source: 'cakto',
        selected_plan: CAKTO_PLANO.key,
      },
    });
    if (authError || !authData?.user?.id) {
      const mensagem = String(authError?.message || '').toLowerCase();
      const jaExiste =
        mensagem.includes('already been registered') ||
        mensagem.includes('already registered') ||
        mensagem.includes('already exists');
      if (jaExiste) {
        // E-mail que já tem conta no sistema: não mexe na conta existente; o admin resolve.
        await soltarReserva({ needs_attention: true, attention_reason: 'email_ja_tem_conta' });
        return { ok: false, code: 'email_ja_tem_conta' };
      }
      await soltarReserva();
      return { ok: false, code: 'erro', detalhe: authError?.message || 'Usuário não foi criado' };
    }
    userId = String(authData.user.id);
  } catch (error: any) {
    await soltarReserva();
    return { ok: false, code: 'erro', detalhe: String(error?.message || error) };
  }

  // Renovações pagas antes do cadastro entram junto, e o vencimento conta do pagamento mais novo.
  let pendentesQuery = supabaseAdmin
    .from('cakto_orders')
    .select('*')
    .eq('kind', 'renewal')
    .eq('status', 'paid')
    .is('establishment_id', null);
  pendentesQuery = livre.subscription_id
    ? pendentesQuery.eq('subscription_id', livre.subscription_id)
    : pendentesQuery.eq('email', email);
  const { data: pendentesData } = await pendentesQuery;
  const pendentes: any[] = Array.isArray(pendentesData) ? pendentesData : [];
  const pagamentos = [livre, ...pendentes];
  const ultimoPagoEm =
    pagamentos
      .map((p) => String(p.paid_at || ''))
      .filter(Boolean)
      .sort()
      .pop() || nowIso;

  const valorMensal = (Number(livre.amount_cents) > 0 ? Number(livre.amount_cents) : CAKTO_PLANO.amountCents) / 100;
  // Conta pronta: serviços, 2 profissionais, horário com almoço, logo e capas de exemplo. Sem passo a passo.
  const contaPronta = montarContaPronta({ planoPrata: CAKTO_PLANO.planPrataActive });
  let establishmentId = '';
  let establishmentCode = '';
  try {
    establishmentCode = await gerarCodigoUnico(supabaseAdmin);
    const { data: establishment, error: establishmentError } = await supabaseAdmin
      .from('establishments')
      .insert({
        name: establishmentName,
        code: establishmentCode,
        description: `Estabelecimento criado automaticamente pela Cakto para ${ownerName}`,
        owner_id: userId,
        business_hours: defaultBusinessHours,
        services_with_prices: [],
        professionals: [],
        profile_image_url: null,
        affiliate_link: null,
        custom_photo_1_url: null,
        custom_photo_2_url: null,
        custom_photo_3_url: null,
        custom_photo_4_url: null,
        custom_photo_5_url: null,
        custom_photo_6_url: null,
        custom_photo_7_url: null,
        carousel_position: 'below',
        has_wifi: false,
        has_parking: false,
        has_accessibility: false,
        wifi_password: null,
        pin_password: null,
        professionals_pins: [],
        whatsapp: input.whatsapp || null,
        payment_status: 'paid',
        plan_type: 'monthly',
        payment_due_date: proximoVencimentoCakto(ultimoPagoEm),
        payment_paid_at: ultimoPagoEm,
        payment_alert_enabled: false,
        is_deleted: false,
        is_blocked: false,
        onboarding_step: 1,
        plan_prata_active: CAKTO_PLANO.planPrataActive,
        admin_profit_value: valorMensal,
        mercadopago_billing_amount: valorMensal,
        ...contaPronta.camposDaBarbearia,
      } as any)
      .select('id')
      .single();
    if (establishmentError || !establishment?.id) {
      throw new Error(establishmentError?.message || 'Estabelecimento não foi criado');
    }
    establishmentId = String((establishment as any).id);
  } catch (error: any) {
    // Sem barbearia o login não serviria para nada: desfaz o usuário para ele poder tentar de novo.
    try {
      await supabaseAdmin.auth.admin.deleteUser(userId);
    } catch {
      // segue: a reserva é solta abaixo e o caso aparece no log
    }
    await soltarReserva();
    return { ok: false, code: 'erro', detalhe: String(error?.message || error) };
  }

  // Daqui para baixo a conta JÁ EXISTE. Falha em registro auxiliar não pode derrubar o cadastro.
  const servicosProntos = await gravarServicosDaContaPronta(supabaseAdmin, establishmentId, contaPronta);
  if (!servicosProntos.ok) {
    console.error('[cakto/cadastro] conta pronta: serviços padrão não gravados', { establishmentId, erro: servicosProntos.erro });
  }

  // Ligar o pedido à conta é o que faz as renovações acharem a barbearia depois: tenta duas vezes.
  const ligarPedidos = async (): Promise<string | null> => {
    try {
      const { error } = await supabaseAdmin
        .from('cakto_orders')
        .update({ used_at: nowIso, owner_id: userId, establishment_id: establishmentId, updated_at: nowIso } as any)
        .in(
          'id',
          pagamentos.map((p) => p.id)
        );
      return error ? String(error.message || error) : null;
    } catch (error: any) {
      return String(error?.message || error);
    }
  };
  let erroLigar = await ligarPedidos();
  if (erroLigar) erroLigar = await ligarPedidos();
  if (erroLigar) {
    console.error('[cakto/cadastro] FALHA ao ligar pedido à conta (renovações não vão achar a barbearia)', {
      establishmentId,
      erro: erroLigar,
    });
  }

  for (const pagamento of pagamentos) {
    const ehPrimeiro = pagamento.id === livre.id;
    try {
      const { error: historicoError } = await supabaseAdmin.from('establishment_billing_payments').upsert(
        {
          establishment_id: establishmentId,
          amount_cents: Number(pagamento.amount_cents) > 0 ? Number(pagamento.amount_cents) : CAKTO_PLANO.amountCents,
          payment_provider: CAKTO_PAYMENT_PROVIDER,
          payment_id: caktoPaymentId(pagamento.cakto_order_id),
          status: 'paid',
          description: ehPrimeiro ? `Cadastro Cakto plano ${CAKTO_PLANO.label}` : `Mensalidade Cakto plano ${CAKTO_PLANO.label}`,
          metadata: {
            type: ehPrimeiro ? 'cakto_signup' : 'cakto_subscription',
            cakto_order_id: pagamento.cakto_order_id,
            cakto_ref_id: pagamento.ref_id || null,
            subscription_id: pagamento.subscription_id || null,
            subscription_period: pagamento.subscription_period ?? null,
            payment_method: pagamento.payment_method || null,
            selected_plan: CAKTO_PLANO.key,
          },
          paid_at: pagamento.paid_at || nowIso,
          updated_at: nowIso,
        } as any,
        { onConflict: 'payment_id' }
      );
      if (historicoError) {
        console.error('[cakto/cadastro] falha ao lançar pagamento no histórico', { establishmentId, erro: historicoError.message });
      }
    } catch (error) {
      console.error('[cakto/cadastro] falha ao lançar pagamento no histórico', { establishmentId, error });
    }
  }

  try {
    // Mesma ficha que o cadastro pago atual cria para o admin. A senha NÃO é guardada.
    const { error: fichaError } = await supabaseAdmin.from('registration_forms').insert({
      client_name: ownerName,
      establishment_name: establishmentName,
      email,
      password: '(definida pelo cliente)',
      client_whatsapp: input.whatsapp || null,
      status: 'approved',
      processed_at: nowIso,
      processed_by: null,
      notes: `Conta criada pelo cliente em /cadastrar apos pagamento na Cakto. Plano: ${CAKTO_PLANO.label}. Codigo: ${establishmentCode}. Pedido Cakto: ${livre.ref_id || livre.cakto_order_id}.`,
      ip_address: input.ip || null,
      user_agent: input.userAgent || null,
      account_type: 'paid',
    } as any);
    if (fichaError) {
      console.error('[cakto/cadastro] falha ao gravar ficha de cadastro', { establishmentId, erro: fichaError.message });
    }
  } catch (error) {
    console.error('[cakto/cadastro] falha ao gravar ficha de cadastro', { establishmentId, error });
  }

  return { ok: true, code: 'ok', establishmentCode, establishmentId, userId };
}
