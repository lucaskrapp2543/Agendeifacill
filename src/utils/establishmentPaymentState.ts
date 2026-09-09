import { endOfDay } from 'date-fns';

/**
 * REGRA ÚNICA de "este estabelecimento está em dia?".
 *
 * POR QUE ISTO EXISTE
 *
 * A mesma pergunta era respondida de dois jeitos diferentes no sistema:
 *
 *   · o painel ADMIN olhava a DATA DE VENCIMENTO — vencimento no futuro = "Pago";
 *   · o painel do BARBEIRO (e a rotina que desliga o alerta) olhava só o campo
 *     `payment_status`.
 *
 * Quando o dono atualizava o vencimento sem que `payment_status` acompanhasse, os
 * dois discordavam: o admin mostrava "Pago" e o barbeiro recebia o popup vermelho
 * "ATENÇÃO URGENTE — pagamento em ATRASO". A rotina que desligaria o alerta também
 * não desligava (ela exigia payment_status === 'paid'), então o alerta ficava preso
 * e só saía se alguém desativasse na mão, um por um.
 *
 * Aconteceu com 4 clientes que estavam rigorosamente em dia. Cobrar quem já pagou é
 * o pior erro que este sistema pode cometer — quebra a confiança do barbeiro.
 *
 * A regra fica AQUI, num lugar só, para nunca mais divergir.
 */

export type EstablishmentPaymentState = 'expired' | 'due_today' | 'paid' | 'pending';

type PaymentFields = {
  payment_status?: string | null;
  payment_due_date?: string | null;
};

/** Lê 'YYYY-MM-DD' como meio-dia LOCAL — evita virar o dia por fuso horário. */
const parseDateOnlySafe = (value?: string | null): number => {
  const raw = String(value || '').trim();
  if (!raw) return NaN;
  const onlyDate = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (onlyDate) {
    const y = Number(onlyDate[1]);
    const m = Number(onlyDate[2]) - 1;
    const d = Number(onlyDate[3]);
    return new Date(y, m, d, 12, 0, 0, 0).getTime();
  }
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : NaN;
};

const isExpiredDue = (dueDate?: string | null): boolean => {
  const dueAt = parseDateOnlySafe(dueDate);
  if (!Number.isFinite(dueAt)) return false;
  return endOfDay(new Date(dueAt)).getTime() < Date.now();
};

const isDueTodayDue = (dueDate?: string | null): boolean => {
  const dueAt = parseDateOnlySafe(dueDate);
  if (!Number.isFinite(dueAt)) return false;
  const dueDateLocal = new Date(dueAt);
  const now = new Date();
  return (
    dueDateLocal.getFullYear() === now.getFullYear() &&
    dueDateLocal.getMonth() === now.getMonth() &&
    dueDateLocal.getDate() === now.getDate()
  );
};

/**
 * Estado exibido do pagamento. É EXATAMENTE a regra que o painel admin já usava na
 * coluna STATUS — copiada sem alteração, para o comportamento do admin não mudar.
 */
export function getEstablishmentPaymentState(est: PaymentFields): EstablishmentPaymentState {
  const status = String(est?.payment_status || '').toLowerCase().trim();
  const dueDate = est?.payment_due_date ?? null;

  if (status === 'expired' || isExpiredDue(dueDate)) return 'expired';
  if (isDueTodayDue(dueDate)) return 'due_today';

  const dueAt = parseDateOnlySafe(dueDate);
  if (Number.isFinite(dueAt)) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
    if (dueAt >= todayStart) return 'paid';
  }

  if (status === 'paid') return 'paid';
  return 'pending';
}

/**
 * Está em dia? Use esta função em QUALQUER lugar que decida cobrar, alertar ou
 * bloquear — nunca comparar `payment_status === 'paid'` na mão.
 */
export const isEstablishmentPaymentEmDia = (est: PaymentFields): boolean =>
  getEstablishmentPaymentState(est) === 'paid';
