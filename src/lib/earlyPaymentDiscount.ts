/**
 * 🔥 Cupom de adiantamento da mensalidade do Agendei Fácil.
 *
 * Regra do produto (definida em 19/10/2026):
 * - 15% de desconto, SÓ no PIX. O cartão vira assinatura recorrente com valor fixo
 *   no Mercado Pago — um desconto ali seria permanente.
 * - Vale de 3 a 1 dia ANTES do vencimento. No dia do vencimento (e depois) não vale.
 * - Quem usa o cupom NÃO perde dias: o vencimento novo é o vencimento atual + 1 mês
 *   (ou + 1 ano no anual). Se o vencimento já tiver passado, conta de hoje, como sempre.
 * - Não acumula com o crédito do Meta Mensal.
 *
 * Este arquivo é usado pelo painel (faixa + modal), pela função Netlify, pelo servidor
 * local e pelo webhook: a regra fica em um lugar só. Só datas e contas — nada de rede.
 */
export const EARLY_PAYMENT_DISCOUNT_PERCENT = 15;
export const EARLY_PAYMENT_WINDOW_DAYS = 3;

export interface DateOnlyParts {
  year: number;
  month: number; // 1-12
  day: number;
}

/** Lê só a data (AAAA-MM-DD) de um valor do banco — ignora hora e fuso, como o painel já faz. */
export function parseDateOnlyParts(raw: unknown): DateOnlyParts | null {
  const match = String(raw ?? '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  if (!parts.year || parts.month < 1 || parts.month > 12 || parts.day < 1 || parts.day > 31) return null;
  return parts;
}

/** Data de hoje no relógio do aparelho (navegador). */
export function getLocalTodayParts(now: Date = new Date()): DateOnlyParts {
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

/** Data de hoje no horário de Brasília — os servidores rodam em UTC. */
export function getBrazilTodayParts(now: Date = new Date()): DateOnlyParts {
  try {
    const formatted = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
    const parsed = parseDateOnlyParts(formatted);
    if (parsed) return parsed;
  } catch {
    // Sem suporte ao fuso: usa a data local.
  }
  return getLocalTodayParts(now);
}

/** Dias inteiros de `from` até `to` (positivo = `to` está no futuro). */
export function daysBetween(from: DateOnlyParts, to: DateOnlyParts): number {
  const a = Date.UTC(from.year, from.month - 1, from.day);
  const b = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((b - a) / 86_400_000);
}

/** Quantos dias faltam para o vencimento (0 = vence hoje, negativo = vencido). null = data inválida. */
export function getDaysUntilDue(dueRaw: unknown, today: DateOnlyParts): number | null {
  const due = parseDateOnlyParts(dueRaw);
  if (!due) return null;
  return daysBetween(today, due);
}

/** Janela do cupom: de 3 a 1 dia antes do vencimento, e o sistema não pode estar marcado como vencido. */
export function isEarlyPaymentWindow(daysUntilDue: number | null, paymentStatus: unknown): boolean {
  if (daysUntilDue === null) return false;
  if (String(paymentStatus ?? '').toLowerCase().trim() === 'expired') return false;
  return daysUntilDue >= 1 && daysUntilDue <= EARLY_PAYMENT_WINDOW_DAYS;
}

export function computeEarlyPaymentDiscount(amountCents: number): {
  percent: number;
  discountCents: number;
  finalCents: number;
} {
  const safeAmount = Math.max(0, Math.round(Number(amountCents) || 0));
  const discountCents = Math.min(safeAmount, Math.max(0, Math.round((safeAmount * EARLY_PAYMENT_DISCOUNT_PERCENT) / 100)));
  return { percent: EARLY_PAYMENT_DISCOUNT_PERCENT, discountCents, finalCents: safeAmount - discountCents };
}

export function toIsoDateOnly(parts: DateOnlyParts): string {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function formatDateOnlyBR(parts: DateOnlyParts | null): string {
  if (!parts) return '';
  return `${String(parts.day).padStart(2, '0')}/${String(parts.month).padStart(2, '0')}/${parts.year}`;
}

export function addDaysToParts(parts: DateOnlyParts, days: number): DateOnlyParts {
  const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** Último dia em que o cupom vale: a véspera do vencimento. */
export function getEarlyPaymentDeadline(dueRaw: unknown): DateOnlyParts | null {
  const due = parseDateOnlyParts(dueRaw);
  return due ? addDaysToParts(due, -1) : null;
}

function addMonthsUTC(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  // Ex.: 31/01 + 1 mês → 28/02 (não pula para março)
  if (d.getUTCDate() < day) d.setUTCDate(0);
  return d;
}

/**
 * Vencimento novo depois de pagar com o cupom: vencimento atual + período do plano.
 * Se o vencimento atual já passou (PIX pago atrasado), conta de hoje, como sempre.
 * Devolve 'AAAA-MM-DD' — o mesmo formato que o webhook já grava.
 */
export function computeDueDateAfterEarlyPayment(
  currentDueRaw: unknown,
  planTypeRaw: unknown,
  today: DateOnlyParts
): string {
  const due = parseDateOnlyParts(currentDueRaw);
  const base = due && daysBetween(today, due) >= 0 ? due : today;
  const baseDate = new Date(Date.UTC(base.year, base.month - 1, base.day));
  const planType = String(planTypeRaw ?? 'monthly').toLowerCase().trim();

  let next: Date;
  if (planType === 'annual') next = addMonthsUTC(baseDate, 12);
  else if (planType === 'trial') next = new Date(baseDate.getTime() + 7 * 86_400_000);
  else next = addMonthsUTC(baseDate, 1);

  return next.toISOString().slice(0, 10);
}
