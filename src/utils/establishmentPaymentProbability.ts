/**
 * Chance de uma barbearia pagar a mensalidade (painel admin → Pagamentos futuros).
 *
 * Ideia do Lucas: barbearia "quente" (agendou hoje) quase sempre paga; barbearia que
 * está há dias sem nenhum agendamento provavelmente não vai pagar. O "último acesso"
 * do admin é a data de criação do último agendamento, e é ele que puxa a conta.
 * Ajustes menores: já vencido, período de teste, bloqueada, nunca pagou, conta nova.
 *
 * Só usa dados que o admin já tem na tela: nenhuma consulta nova.
 */
export type PaymentHeat = 'quente' | 'morno' | 'frio';

export interface PaymentProbabilityInput {
  /** created_at do último agendamento (campo last_access do admin). */
  lastAppointmentAt?: string | null;
  /** 'paid' | 'unpaid' | 'expired' */
  paymentStatus?: string | null;
  /** Quando foi marcado como pago pela última vez. */
  paymentPaidAt?: string | null;
  /** 'monthly' | 'annual' | 'trial' */
  planType?: string | null;
  isBlocked?: boolean | null;
  /** Criação da conta. */
  createdAt?: string | null;
}

export interface PaymentProbability {
  /** 5..95 */
  percent: number;
  heat: PaymentHeat;
  /** "agendou há 10h", "3 dias sem agendar", "nunca agendou" */
  activityLabel: string;
  /** Ajustes aplicados, em texto curto (para o tooltip/linha de baixo). */
  reasons: string[];
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const parseTime = (value?: string | null): number => {
  const raw = String(value || '').trim();
  if (!raw) return NaN;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : NaN;
};

/** Base pela atividade: quantos dias desde o último agendamento. */
const baseByActivity = (lastAppointmentAt: string | null | undefined, now: number): { base: number; label: string } => {
  const t = parseTime(lastAppointmentAt);
  if (!Number.isFinite(t)) return { base: 10, label: 'nunca agendou' };
  const diff = Math.max(0, now - t);
  const hours = Math.floor(diff / HOUR_MS);
  const days = Math.floor(diff / DAY_MS);
  if (days === 0) {
    return { base: 90, label: hours < 1 ? 'agendou agora há pouco' : `agendou há ${hours}h` };
  }
  if (days === 1) return { base: 75, label: '1 dia sem agendar' };
  if (days === 2) return { base: 55, label: '2 dias sem agendar' };
  if (days === 3) return { base: 30, label: '3 dias sem agendar' };
  if (days === 4) return { base: 25, label: '4 dias sem agendar' };
  if (days === 5) return { base: 18, label: '5 dias sem agendar' };
  if (days <= 7) return { base: 12, label: `${days} dias sem agendar` };
  return { base: 8, label: `${days} dias sem agendar` };
};

export const getPaymentHeat = (percent: number): PaymentHeat =>
  percent >= 70 ? 'quente' : percent >= 40 ? 'morno' : 'frio';

export function computeEstablishmentPaymentProbability(
  input: PaymentProbabilityInput,
  now: number = Date.now()
): PaymentProbability {
  const { base, label } = baseByActivity(input.lastAppointmentAt, now);
  let percent = base;
  const reasons: string[] = [];

  const status = String(input.paymentStatus || '').trim().toLowerCase();
  if (status === 'expired') {
    percent -= 25;
    reasons.push('já venceu');
  }

  const plan = String(input.planType || '').trim().toLowerCase();
  if (plan === 'trial') {
    percent -= 15;
    reasons.push('período de teste');
  }

  if (input.isBlocked) {
    percent -= 20;
    reasons.push('bloqueada');
  }

  const paidAt = parseTime(input.paymentPaidAt);
  if (Number.isFinite(paidAt)) {
    if (now - paidAt <= 45 * DAY_MS) {
      percent += 5;
      reasons.push('pagou o último mês');
    }
  } else {
    percent -= 5;
    reasons.push('nunca pagou');
  }

  const createdAt = parseTime(input.createdAt);
  if (Number.isFinite(createdAt) && now - createdAt <= 30 * DAY_MS) {
    percent -= 5;
    reasons.push('conta nova');
  }

  percent = Math.max(5, Math.min(95, Math.round(percent)));
  return { percent, heat: getPaymentHeat(percent), activityLabel: label, reasons };
}
