/**
 * "Últimos pagamentos" do Menu Admin: quanto o Agendei Fácil recebeu de cada mensalidade.
 * Só cálculo, sem tela e sem banco, para poder ser testado fora do navegador.
 *
 * - Automático: líquido exato do Mercado Pago; se ainda não veio, estimativa pela taxa (≈).
 * - Manual: o "lucro" informado no admin; sem ele, o valor da mensalidade (≈).
 */

export type LastPaymentNetInfo = {
  value: number | null;
  exact: boolean;
  gross: number | null;
  fee: number | null;
  note: string;
};

export type OnlinePaymentInfo = {
  amountCents: number | null;
  netAmount: number | null;
  mpFeeAmount: number | null;
  paymentMethod: string;
  paymentProvider: string;
};

export type ManualPaymentSource = {
  admin_profit_value?: number | string | null;
  mercadopago_billing_amount?: number | string | null;
};

export type LastPaymentRow = {
  key: string;
  name: string;
  code: string;
  planLabel: string;
  /** Situação da barbearia hoje. null quando ela não está mais na lista. */
  statusLabel: 'Pago' | 'Pendente' | 'Vencido' | null;
  source: 'auto' | 'manual';
  methodLabel: string;
  paidAt: number | null;
  net: LastPaymentNetInfo;
};

export const MANUAL_METHOD_LABEL = 'Manual (não informado)';

export function netFromOnlinePayment(payment: OnlinePaymentInfo): LastPaymentNetInfo {
  const gross = payment.amountCents !== null ? payment.amountCents / 100 : null;
  if (payment.netAmount !== null) {
    return { value: payment.netAmount, exact: true, gross, fee: payment.mpFeeAmount, note: 'líquido exato do Mercado Pago' };
  }
  if (gross !== null) {
    const method = String(payment.paymentMethod || '').toLowerCase();
    const provider = String(payment.paymentProvider || '').toLowerCase();
    const isCard = method.includes('credit') || method.includes('card') || method.includes('cred') || provider.includes('subscription');
    const rate = isCard ? 0.0499 : method.includes('debit') ? 0.0199 : 0.0099;
    return { value: Math.round(gross * (1 - rate) * 100) / 100, exact: false, gross, fee: null, note: 'estimativa pela taxa do Mercado Pago' };
  }
  return { value: null, exact: false, gross: null, fee: null, note: 'valor não disponível' };
}

export function netFromManualPayment(source: ManualPaymentSource): LastPaymentNetInfo {
  const informed = Number(source.admin_profit_value ?? 0);
  if (Number.isFinite(informed) && informed > 0) {
    return { value: Math.round(informed * 100) / 100, exact: true, gross: null, fee: null, note: 'líquido informado por você' };
  }
  const planAmount = Number(source.mercadopago_billing_amount ?? 0);
  if (Number.isFinite(planAmount) && planAmount > 0) {
    return { value: Math.round(planAmount * 100) / 100, exact: false, gross: planAmount, fee: null, note: 'valor da mensalidade (bruto) — líquido não informado' };
  }
  return { value: null, exact: false, gross: null, fee: null, note: 'valor não informado' };
}

export function onlinePaymentMethodLabel(payment: Pick<OnlinePaymentInfo, 'paymentMethod' | 'paymentProvider'>): string {
  const method = String(payment.paymentMethod || '').toLowerCase();
  if (
    method.includes('recurring_card') ||
    method.includes('credit_card') ||
    method.includes('credito') ||
    method.includes('credit')
  ) {
    return 'Crédito';
  }
  if (method.includes('pix')) return 'PIX';

  const provider = String(payment.paymentProvider || '').toLowerCase();
  if (provider.includes('subscription') || provider.includes('card') || provider.includes('credit') || provider.includes('credito')) {
    return 'Crédito';
  }
  if (provider.includes('pix') || provider.includes('mercadopago') || provider.includes('pagarme')) {
    return 'PIX';
  }
  return 'Automático';
}

export function statusLabelOf(paymentStatus: unknown): 'Pago' | 'Pendente' | 'Vencido' {
  if (paymentStatus === 'paid') return 'Pago';
  if (paymentStatus === 'expired') return 'Vencido';
  return 'Pendente';
}

export function filterLastPayments(rows: LastPaymentRow[], search: string): LastPaymentRow[] {
  const term = String(search || '').toLowerCase().trim();
  if (!term) return rows;
  return rows.filter((row) => row.name.toLowerCase().includes(term) || row.code.toLowerCase().includes(term));
}

export type LastPaymentsSummary = {
  count: number;
  autoCount: number;
  manualCount: number;
  /** Quanto entrou, líquido. */
  net: number;
  gross: number;
  /** Bruto menos líquido, só de quem tem os dois (manual informado não tem bruto). */
  fees: number;
  estimatedCount: number;
  withoutValueCount: number;
};

/** Soma em centavos: somar reais direto acumula erro de arredondamento. */
export function summarizeLastPayments(rows: LastPaymentRow[]): LastPaymentsSummary {
  const toCents = (v: number) => Math.round(v * 100);
  let netCents = 0;
  let grossCents = 0;
  let feeCents = 0;
  let autoCount = 0;
  let manualCount = 0;
  let estimatedCount = 0;
  let withoutValueCount = 0;
  for (const row of rows) {
    if (row.source === 'auto') autoCount += 1;
    else manualCount += 1;
    const { value, gross, exact } = row.net;
    if (value === null) {
      withoutValueCount += 1;
    } else {
      netCents += toCents(value);
      if (!exact) estimatedCount += 1;
    }
    if (gross !== null) grossCents += toCents(gross);
    if (gross !== null && value !== null && gross > value) feeCents += toCents(gross) - toCents(value);
  }
  return {
    count: rows.length,
    autoCount,
    manualCount,
    net: netCents / 100,
    gross: grossCents / 100,
    fees: feeCents / 100,
    estimatedCount,
    withoutValueCount,
  };
}
