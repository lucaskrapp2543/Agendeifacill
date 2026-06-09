export type AppointmentPaymentChannel =
  | 'system_online_pix'
  | 'system_online_card'
  | 'local_establishment'
  | 'awaiting_online_payment'
  | 'subscriber'
  | 'unknown';

const INFORMED_PAYMENT_LABELS: Record<string, string> = {
  pix: 'PIX',
  pix_now: 'PIX',
  credito: 'Cartão de crédito',
  credit_card: 'Cartão de crédito',
  credit: 'Cartão de crédito',
  debito: 'Cartão de débito',
  debit_card: 'Cartão de débito',
  dinheiro: 'Dinheiro',
  pagar_local: 'Pagar no estabelecimento',
  transferencia: 'Transferência',
  pendente: 'A definir no local',
  assinante: 'Assinatura',
  multi: 'Pagamento misto',
};

/** Pagamento confirmado pelo gateway (Mercado Pago / Pagar.me), não só texto escolhido no booking. */
export function isSystemConfirmedPayment(appointment: any): boolean {
  const paymentStatus = String(appointment?.payment_status || '').trim().toLowerCase();
  const pixStatus = String(appointment?.pix_payment_status || '').trim().toLowerCase();
  const txId = String(appointment?.payment_transaction_id || '').trim();
  const isPaid = paymentStatus === 'paid' || pixStatus === 'confirmado' || pixStatus === 'aprovado';
  return isPaid && Boolean(txId);
}

export function resolveAppointmentPaymentChannel(appointment: any): AppointmentPaymentChannel {
  const status = String(appointment?.status || '').trim().toLowerCase();
  const method = String(appointment?.payment_method || '').trim().toLowerCase();
  const pixStatus = String(appointment?.pix_payment_status || '').trim().toLowerCase();

  if (method === 'assinante' || appointment?.is_subscriber === true) {
    return 'subscriber';
  }

  if (isSystemConfirmedPayment(appointment)) {
    const isPix =
      method === 'pix' ||
      method === 'pix_now' ||
      pixStatus === 'confirmado' ||
      pixStatus === 'aprovado';
    if (isPix) return 'system_online_pix';

    const isCard =
      method === 'credito' ||
      method === 'credit_card' ||
      method === 'credit' ||
      method === 'debito' ||
      method === 'debit_card';
    if (isCard) return 'system_online_card';

    // Pago pelo sistema, mas método veio vazio/inconsistente — tratar como online.
    return 'system_online_pix';
  }

  if (status === 'pending_payment') {
    return 'awaiting_online_payment';
  }

  return 'local_establishment';
}

function getInformedPaymentLabel(method: string): string {
  if (!method) return 'Não informada';
  return INFORMED_PAYMENT_LABELS[method] || method;
}

function getActualPaymentLabel(channel: AppointmentPaymentChannel): string {
  switch (channel) {
    case 'system_online_pix':
      return 'PIX via sistema';
    case 'system_online_card':
      return 'Cartão via sistema';
    case 'local_establishment':
      return 'Pagamento no estabelecimento';
    case 'awaiting_online_payment':
      return 'Aguardando pagamento online';
    case 'subscriber':
      return 'Assinatura';
    default:
      return 'Não identificado';
  }
}

/** Separa o que o cliente informou (rótulo configurável) do que o sistema reconhece de fato. */
export function getAppointmentPaymentDisplay(appointment: any): {
  channel: AppointmentPaymentChannel;
  informedLabel: string;
  actualLabel: string;
  showInformedPreference: boolean;
} {
  const channel = resolveAppointmentPaymentChannel(appointment);
  const method = String(appointment?.payment_method || '').trim().toLowerCase();
  const informedLabel = getInformedPaymentLabel(method);
  const actualLabel =
    channel === 'local_establishment' && method
      ? informedLabel
      : getActualPaymentLabel(channel);

  const showInformedPreference =
    channel === 'system_online_pix' ||
    channel === 'system_online_card' ||
    (channel === 'local_establishment' &&
      ['pix', 'credito', 'debito', 'transferencia', 'pix_now', 'credit_card', 'debit_card'].includes(method));

  return {
    channel,
    informedLabel,
    actualLabel,
    showInformedPreference,
  };
}

export function isLocalAfcoinPaymentMethod(method: unknown): boolean {
  const normalized = String(method || '').trim().toLowerCase();
  return ['pagar_local', 'dinheiro', 'local', 'cash', 'no_local', 'estabelecimento', 'pendente'].includes(
    normalized
  );
}

export const AFCOIN_POINTS_LOCAL = 18;
export const AFCOIN_POINTS_ONLINE = 60;

/** Só agendamentos com data do serviço >= esta data entram no programa AFCoins. */
export const AFCOIN_PROGRAM_START_DATE = '2026-06-08';

export function getAppointmentServiceDateIso(appointment: any): string {
  return String(appointment?.appointment_date || '').trim().slice(0, 10);
}

export function isAppointmentEligibleForAfcoins(appointment: any): boolean {
  const dateIso = getAppointmentServiceDateIso(appointment);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return false;
  return dateIso >= AFCOIN_PROGRAM_START_DATE;
}

/** Pontos AFCoins que este agendamento vale (0 se cancelado/assinante/aguardando pagamento). */
export function computeAfcoinPointsForAppointment(appointment: any): number {
  if (!isAppointmentEligibleForAfcoins(appointment)) return 0;

  const status = String(appointment?.status || '').trim().toLowerCase();
  if (status === 'cancelled') return 0;

  const channel = resolveAppointmentPaymentChannel(appointment);
  if (channel === 'system_online_pix' || channel === 'system_online_card') {
    return AFCOIN_POINTS_ONLINE;
  }
  if (channel === 'local_establishment') {
    return AFCOIN_POINTS_LOCAL;
  }
  return 0;
}

/** Soma total: 18 × pagar no local, 60 × PIX/cartão via sistema. */
export function computeAfcoinBalanceFromAppointments(appointments: any[]): number {
  if (!Array.isArray(appointments) || appointments.length === 0) return 0;
  return appointments.reduce((sum, apt) => sum + computeAfcoinPointsForAppointment(apt), 0);
}

export function computeAfcoinBalanceByEstablishment(appointments: any[]): Map<string, number> {
  const map = new Map<string, number>();
  if (!Array.isArray(appointments)) return map;

  for (const apt of appointments) {
    const points = computeAfcoinPointsForAppointment(apt);
    if (points <= 0) continue;
    const establishmentId = String(apt?.establishment_id || apt?.establishments?.id || '').trim();
    if (!establishmentId) continue;
    map.set(establishmentId, (map.get(establishmentId) || 0) + points);
  }
  return map;
}

/** Valor a cobrar no checkout (serviço + produtos extras do booking). */
export function resolveBookingPaymentAmount(data: any): number {
  const totalPrice = Number(data?.total_price);
  if (Number.isFinite(totalPrice) && totalPrice > 0) {
    return Math.round(totalPrice * 100) / 100;
  }

  const servicePrice = Number(data?.price || 0);
  const products = Array.isArray(data?.additional_products) ? data.additional_products : [];
  const productsTotal = products.reduce((sum: number, item: any) => {
    const price = Number(item?.price || 0);
    const qty = Math.max(1, Number(item?.quantity || 1));
    return sum + (Number.isFinite(price) ? price * qty : 0);
  }, 0);

  const combined = servicePrice + productsTotal;
  if (Number.isFinite(combined) && combined > 0) {
    return Math.round(combined * 100) / 100;
  }

  return Number.isFinite(servicePrice) && servicePrice > 0 ? servicePrice : 0;
}
