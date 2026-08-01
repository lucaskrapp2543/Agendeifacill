import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { createMPPayment, CreateMPPaymentRequest } from '../../src/lib/mercadopago/mp-service';
import { getValidMercadoPagoAccessToken } from './mercadopago-create-payment';
import { json, parseJsonBody } from './_utils';

/**
 * 💳 COBRAR CLIENTE — gera um PIX de balcão para um agendamento.
 *
 * Para atendimentos que NÃO foram pagos online: o barbeiro aperta o botão, o
 * cliente lê o QR Code ali na hora e paga. O dinheiro cai na conta do Mercado
 * Pago do próprio barbeiro; a plataforma fica com a taxa (application_fee).
 *
 * O QUE ESTA FUNÇÃO NÃO FAZ (de propósito):
 *   • não escreve NADA em `appointments` — status, payment_status e
 *     payment_transaction_id ficam exatamente como estavam;
 *   • não conclui, não confirma e não cancela agendamento.
 * Quem conclui o atendimento é o barbeiro, como sempre foi.
 *
 * O valor cobrado é lido do banco, nunca do corpo da requisição — assim
 * ninguém consegue mandar um valor diferente do preço do serviço.
 */

const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    : null;

/** Mesma regra do badge no card: qualquer sinal de pagamento online bloqueia. */
const hasOnlinePayment = (appointment: any): boolean => {
  const paymentStatus = String(appointment?.payment_status || '').toLowerCase().trim();
  const transactionId = String(appointment?.payment_transaction_id || '').trim();
  const pixStatus = String(appointment?.pix_payment_status || '').toLowerCase().trim();
  return (
    paymentStatus === 'paid' ||
    Boolean(transactionId) ||
    pixStatus === 'aprovado' ||
    pixStatus === 'approved' ||
    pixStatus === 'confirmado'
  );
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' }, { Allow: 'POST' });
  }

  try {
    if (!supabaseAdmin) {
      return json(500, { error: 'Supabase admin nao configurado' });
    }

    // -----------------------------------------------------------------------
    // 1) Quem está pedindo? Sem sessão válida, ninguém gera cobrança.
    // -----------------------------------------------------------------------
    const authHeader = String(
      event.headers?.authorization || (event.headers as any)?.Authorization || ''
    ).trim();
    const accessToken = authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : '';

    if (!accessToken) {
      return json(401, {
        error: 'Nao autenticado',
        userMessage: 'Sua sessao expirou. Entre novamente e tente de novo.',
      });
    }

    // Valida o token do usuário usando o próprio cliente admin. Evita depender
    // de uma ANON_KEY nas variáveis de ambiente — nenhuma outra function do
    // projeto usa essa variável, então ela pode simplesmente não existir na
    // Netlify, e o botão quebraria só em produção.
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
    const userId = String(userData?.user?.id || '').trim();
    if (userError || !userId) {
      return json(401, {
        error: 'Sessao invalida',
        userMessage: 'Sua sessao expirou. Entre novamente e tente de novo.',
      });
    }

    const body = parseJsonBody<any>(event) || {};
    const appointmentId = String(body?.appointmentId || '').trim();
    if (!appointmentId) {
      return json(400, { error: 'Dados invalidos', required: ['appointmentId'] });
    }

    // -----------------------------------------------------------------------
    // 2) O agendamento existe e pode ser cobrado?
    // -----------------------------------------------------------------------
    const { data: appointment, error: appointmentError } = await supabaseAdmin
      .from('appointments')
      .select(
        'id, establishment_id, status, payment_status, payment_transaction_id, pix_payment_status, price, total_price, client_name, is_subscriber'
      )
      .eq('id', appointmentId)
      .single();

    if (appointmentError || !appointment) {
      return json(404, { error: 'Agendamento nao encontrado' });
    }

    const establishmentId = String((appointment as any)?.establishment_id || '').trim();
    if (!establishmentId) {
      return json(400, { error: 'Agendamento sem estabelecimento' });
    }

    // Só o dono do estabelecimento cobra. Sem isso, qualquer conta logada
    // poderia gerar cobrança em agendamento de outra barbearia.
    const { data: establishment, error: establishmentError } = await supabaseAdmin
      .from('establishments')
      .select('id, name, owner_id')
      .eq('id', establishmentId)
      .single();

    if (establishmentError || !establishment) {
      return json(404, { error: 'Estabelecimento nao encontrado' });
    }

    if (String((establishment as any)?.owner_id || '') !== userId) {
      return json(403, {
        error: 'Sem permissao',
        userMessage: 'Voce nao tem permissao para cobrar neste agendamento.',
      });
    }

    const appointmentStatus = String((appointment as any)?.status || '').toLowerCase().trim();

    if (appointmentStatus === 'cancelled') {
      return json(400, {
        error: 'Agendamento cancelado',
        userMessage: 'Este agendamento foi cancelado e nao pode ser cobrado.',
      });
    }

    // `pending_payment` = o cliente já começou um pagamento online e o sistema
    // está esperando. Cobrar no balcão agora arriscaria o cliente pagar duas
    // vezes — uma pelo link, outra pelo QR.
    if (appointmentStatus === 'pending_payment') {
      return json(400, {
        error: 'Pagamento online em andamento',
        userMessage: 'Este atendimento esta aguardando um pagamento online. Cobrar agora pode gerar cobranca duplicada.',
      });
    }

    if ((appointment as any)?.is_subscriber === true) {
      return json(400, {
        error: 'Agendamento de assinante',
        userMessage: 'Este atendimento e de assinante e nao deve ser cobrado avulso.',
      });
    }

    if (hasOnlinePayment(appointment)) {
      return json(400, {
        error: 'Agendamento ja possui pagamento online',
        userMessage: 'Este atendimento ja foi pago online. Cobrar de novo geraria cobranca duplicada.',
      });
    }

    // -----------------------------------------------------------------------
    // 3) Valor vem do BANCO, nunca do navegador.
    // -----------------------------------------------------------------------
    const rawPrice = Number(
      (appointment as any)?.total_price ?? (appointment as any)?.price ?? 0
    );
    const amountCents = Math.round((Number.isFinite(rawPrice) ? rawPrice : 0) * 100);

    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return json(400, {
        error: 'Agendamento sem valor definido',
        userMessage: 'Este atendimento nao tem valor definido. Ajuste o preco antes de cobrar.',
      });
    }

    // Taxa da plataforma — mesma configuração usada nos pagamentos do booking.
    const applicationFeeRaw =
      process.env.MERCADOPAGO_PLATFORM_FEE_CENTS ||
      process.env.PLATFORM_FEE_CENTS ||
      '100';
    const applicationFee = Math.max(0, Math.round(Number(String(applicationFeeRaw).trim()) || 100));

    // O Mercado Pago exige application_fee menor que o valor cobrado.
    if (amountCents <= applicationFee) {
      return json(400, {
        error: 'Valor abaixo do minimo',
        userMessage: 'O valor deste atendimento e baixo demais para cobranca online.',
      });
    }

    // -----------------------------------------------------------------------
    // 4) Já existe cobrança aberta? Devolve a MESMA — nunca gera dois QR Codes
    //    para o mesmo atendimento (evita o cliente pagar duas vezes).
    // -----------------------------------------------------------------------
    const { data: existingCharge } = await supabaseAdmin
      .from('appointment_local_charges')
      .select('id, payment_id, amount_cents, qr_code, qr_code_base64, status')
      .eq('appointment_id', appointmentId)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingCharge && String((existingCharge as any).qr_code || '').trim()) {
      return json(200, {
        reused: true,
        charge_id: (existingCharge as any).id,
        payment_id: (existingCharge as any).payment_id,
        amount_cents: (existingCharge as any).amount_cents,
        qr_code: (existingCharge as any).qr_code,
        qr_code_base64: (existingCharge as any).qr_code_base64,
      });
    }

    const { data: paidCharge } = await supabaseAdmin
      .from('appointment_local_charges')
      .select('id, payment_id, amount_cents, paid_at')
      .eq('appointment_id', appointmentId)
      .eq('status', 'paid')
      .maybeSingle();

    if (paidCharge) {
      return json(200, {
        already_paid: true,
        charge_id: (paidCharge as any).id,
        payment_id: (paidCharge as any).payment_id,
        amount_cents: (paidCharge as any).amount_cents,
        paid_at: (paidCharge as any).paid_at,
      });
    }

    // -----------------------------------------------------------------------
    // 5) Cria o PIX na conta do Mercado Pago do próprio estabelecimento.
    // -----------------------------------------------------------------------
    let mpAccessToken: string;
    try {
      mpAccessToken = await getValidMercadoPagoAccessToken(establishmentId);
    } catch (tokenError: any) {
      return json(400, {
        error: String(tokenError?.message || 'Falha ao obter token do Mercado Pago'),
        userMessage: 'Conecte (ou reconecte) sua conta do Mercado Pago para cobrar pelo sistema.',
      });
    }

    const clientName = String((appointment as any)?.client_name || 'Cliente').trim();

    // ⚠️ O prefixo NÃO pode começar com "appointment_" e a metadata NÃO pode ter
    // a chave `appointment_id`. Existe uma função no projeto
    // (confirmAppointmentFromMpPayment.ts) que procura esses dois campos e
    // CONFIRMA o agendamento — exatamente o que esta feature não pode fazer.
    // Usamos nomes que ela não reconhece; o vínculo com o agendamento vive na
    // tabela appointment_local_charges, que é a única fonte deste fluxo.
    const externalReference = `local_charge:${appointmentId}`;

    const paymentData: CreateMPPaymentRequest = {
      amount: amountCents,
      description: `Atendimento - ${clientName}`.slice(0, 120),
      payer: { email: `balcao_${appointmentId.slice(0, 8)}@agendeifacil.com` },
      application_fee: applicationFee,
      access_token: mpAccessToken,
      payment_method_id: 'pix',
      external_reference: externalReference,
      metadata: {
        type: 'appointment_local_charge',
        local_charge_appointment_id: appointmentId,
        local_charge_establishment_id: establishmentId,
      },
    };

    const payment = await createMPPayment(paymentData);
    const paymentId = String((payment as any)?.id || '').trim();
    if (!paymentId) {
      return json(500, { error: 'Pagamento criado sem ID' });
    }

    const pixData = (payment as any)?.point_of_interaction?.transaction_data || {};
    const qrCode = String(pixData?.qr_code || '').trim();
    const qrCodeBase64 = String(pixData?.qr_code_base64 || '').trim();

    if (!qrCode && !qrCodeBase64) {
      return json(500, {
        error: 'Mercado Pago nao retornou QR Code',
        userMessage: 'Nao foi possivel gerar o QR Code agora. Tente novamente.',
      });
    }

    // -----------------------------------------------------------------------
    // 6) Registra na tabela isolada. `appointments` continua intocada.
    // -----------------------------------------------------------------------
    const { data: savedCharge, error: saveError } = await supabaseAdmin
      .from('appointment_local_charges')
      .insert({
        establishment_id: establishmentId,
        appointment_id: appointmentId,
        amount_cents: amountCents,
        payment_provider: 'mercadopago',
        payment_id: paymentId,
        status: 'pending',
        qr_code: qrCode || null,
        qr_code_base64: qrCodeBase64 || null,
        external_reference: externalReference,
        created_by: userId,
        metadata: {
          origin: 'establishment_dashboard',
          application_fee_cents: applicationFee,
          client_name: clientName,
        },
      } as any)
      .select('id')
      .maybeSingle();

    if (saveError) {
      // O PIX existe no Mercado Pago mas não conseguimos registrar. Devolvemos o
      // QR assim mesmo (o cliente pode pagar), e avisamos que a confirmação
      // automática pode não acontecer — melhor do que sumir com a cobrança.
      console.error('❌ [MP Local Charge] Erro ao salvar cobranca:', saveError);
      return json(200, {
        charge_id: null,
        payment_id: paymentId,
        amount_cents: amountCents,
        qr_code: qrCode,
        qr_code_base64: qrCodeBase64,
        warning: 'nao_registrado',
        userMessage: 'QR Code gerado, mas houve falha ao registrar. Confira o pagamento no seu Mercado Pago.',
      });
    }

    return json(200, {
      charge_id: (savedCharge as any)?.id || null,
      payment_id: paymentId,
      amount_cents: amountCents,
      qr_code: qrCode,
      qr_code_base64: qrCodeBase64,
      application_fee_cents: applicationFee,
    });
  } catch (error: any) {
    console.error('❌ [MP Local Charge] Erro:', error);
    return json(500, {
      error: String(error?.message || 'Erro ao gerar cobranca PIX'),
      userMessage: 'Nao foi possivel gerar a cobranca agora. Tente novamente.',
    });
  }
};
