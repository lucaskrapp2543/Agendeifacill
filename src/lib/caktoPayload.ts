/**
 * Leitura do aviso (webhook) da Cakto — só contas, sem banco.
 *
 * Contrato oficial (docs.cakto.com.br/conceitos/webhooks):
 *   corpo = { secret, event, data }
 *   data  = o pedido (objeto) OU uma lista de pedidos (webhook "V2" criado pelo painel)
 * Campos usados: id, refId, status, offer_type, amount, paymentMethod, customer{name,email,phone,docNumber},
 * product{id,name}, offer{id,price}, subscription, subscription_period, paidAt, refundedAt, chargedbackAt.
 */
export interface CaktoOrder {
  id: string;
  refId: string;
  status: string;
  offerType: string;
  amountCents: number;
  paymentMethod: string;
  email: string;
  customerName: string;
  customerPhone: string;
  customerDoc: string;
  productId: string;
  productName: string;
  offerId: string;
  subscriptionId: string;
  subscriptionPeriod: number | null;
  paidAt: string | null;
  refundedAt: string | null;
}

export type CaktoAction =
  | 'paid'
  | 'refunded'
  | 'chargeback'
  | 'subscription_canceled'
  | 'attention'
  | 'ignore';

const txt = (v: unknown): string => String(v ?? '').trim();

const soDigitos = (v: unknown): string => {
  let out = '';
  for (const c of String(v ?? '')) if (c >= '0' && c <= '9') out += c;
  return out;
};

/** Aceita 67.9, "67,90", "R$ 67,90", "1.234,56". */
export function numeroCakto(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  let t = '';
  for (const c of String(v ?? '')) if ((c >= '0' && c <= '9') || c === ',' || c === '.') t += c;
  if (t.includes(',')) t = t.split('.').join('').split(',').join('.');
  const n = parseFloat(t);
  return t && Number.isFinite(n) ? n : 0;
}

export function emailValido(valor: unknown): boolean {
  const t = txt(valor);
  const a = t.indexOf('@');
  if (a <= 0 || t.indexOf('@', a + 1) !== -1 || t.includes(' ') || t.length > 254) return false;
  const dominio = t.slice(a + 1);
  return dominio.indexOf('.') > 0 && !dominio.endsWith('.');
}

export const normalizarEmail = (valor: unknown): string => txt(valor).toLowerCase();

const dataIso = (v: unknown): string | null => {
  const t = txt(v);
  if (!t) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

function lerPedido(item: any): CaktoOrder | null {
  if (!item || typeof item !== 'object') return null;
  const cliente = item.customer && typeof item.customer === 'object' ? item.customer : {};
  const produto = item.product && typeof item.product === 'object' ? item.product : {};
  const oferta = item.offer && typeof item.offer === 'object' ? item.offer : {};
  const assinatura = item.subscription && typeof item.subscription === 'object' ? item.subscription : {};
  const valor = numeroCakto(item.amount) || numeroCakto(oferta.price) || numeroCakto(item.baseAmount);
  const periodoBruto = item.subscription_period ?? assinatura.period ?? assinatura.current_period;
  const periodo = Number(periodoBruto);
  return {
    id: txt(item.id),
    refId: txt(item.refId),
    status: txt(item.status).toLowerCase(),
    offerType: txt(item.offer_type).toLowerCase(),
    amountCents: Math.round(valor * 100),
    paymentMethod: txt(item.paymentMethod).toLowerCase(),
    email: normalizarEmail(cliente.email),
    customerName: txt(cliente.name).slice(0, 160),
    customerPhone: soDigitos(cliente.phone).slice(0, 20),
    customerDoc: soDigitos(cliente.docNumber).slice(0, 20),
    productId: txt(produto.id),
    productName: txt(produto.name).slice(0, 160),
    offerId: txt(oferta.id),
    subscriptionId: txt(assinatura.id || assinatura.subscription_id || assinatura.code),
    subscriptionPeriod: periodoBruto !== undefined && periodoBruto !== null && Number.isFinite(periodo) ? periodo : null,
    paidAt: dataIso(item.paidAt),
    refundedAt: dataIso(item.refundedAt) || dataIso(item.chargedbackAt),
  };
}

/** Devolve o nome do evento e os pedidos do aviso (sempre lista, mesmo quando vem um só). */
export function lerAvisoCakto(corpo: any): { event: string; orders: CaktoOrder[] } {
  const event = txt(corpo?.event).toLowerCase();
  const bruto = Array.isArray(corpo?.data) ? corpo.data : corpo?.data ? [corpo.data] : [];
  const orders: CaktoOrder[] = [];
  for (const item of bruto) {
    const pedido = lerPedido(item);
    // checkout_abandonment não tem id: não é pedido, fica de fora.
    if (pedido && pedido.id) orders.push(pedido);
  }
  return { event, orders };
}

const EVENTOS_DE_PAGAMENTO = ['purchase_approved', 'subscription_renewed', 'subscription_late_recovered'];

/** O que fazer com cada aviso. Evento desconhecido é só registrado. */
export function classificarAvisoCakto(eventRaw: unknown, statusRaw: unknown): CaktoAction {
  const event = txt(eventRaw).toLowerCase();
  const status = txt(statusRaw).toLowerCase();
  if (event === 'refund') return 'refunded';
  // "chargeback" também dispara no pré-chargeback e no MED do Pix (status "MED").
  if (event === 'chargeback') return 'chargeback';
  if (event === 'subscription_canceled') return 'subscription_canceled';
  if (event === 'refund_requested' || event === 'dispute_defense_requested') return 'attention';
  if (EVENTOS_DE_PAGAMENTO.includes(event)) {
    return status === 'paid' || status === 'approved' || status === '' ? 'paid' : 'ignore';
  }
  return 'ignore';
}

/** O aviso sem o segredo — é assim que ele é guardado no banco. */
export function avisoSemSegredo(corpo: any): any {
  if (!corpo || typeof corpo !== 'object') return {};
  const resto: Record<string, unknown> = { ...(corpo as Record<string, unknown>) };
  delete resto.secret;
  return resto;
}
