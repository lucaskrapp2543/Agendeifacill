/**
 * Intervalo de datas para contar usos da assinatura (limite por servico / total).
 * Mantem o helper legado por periodo da assinatura, mas agora tambem expoe
 * janelas mensais para a regra de saldo carregado do mes anterior.
 */
export type IsoDateRange = {
  periodMin: string;
  periodMax: string;
};

const toIsoDateOnly = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const maxIsoDate = (a: string, b: string): string => (a > b ? a : b);
const minIsoDate = (a: string, b: string): string => (a < b ? a : b);

export function getSubscriptionUsageDateRange(
  clientSubscription: { start_date?: string | null; end_date?: string | null } | null | undefined,
  fallbackTargetDate: Date
): IsoDateRange {
  const start = String(clientSubscription?.start_date || '').slice(0, 10);
  const end = String(clientSubscription?.end_date || '').slice(0, 10);
  if (start && end && start <= end) {
    return { periodMin: start, periodMax: end };
  }
  return getCalendarMonthDateRange(fallbackTargetDate);
}

export function getCalendarMonthDateRange(targetDate: Date): IsoDateRange {
  const firstDayOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
  const lastDayOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
  return {
    periodMin: toIsoDateOnly(firstDayOfMonth),
    periodMax: toIsoDateOnly(lastDayOfMonth),
  };
}

export function getPreviousCalendarMonthDateRange(targetDate: Date): IsoDateRange {
  return getCalendarMonthDateRange(new Date(targetDate.getFullYear(), targetDate.getMonth() - 1, 1));
}

export function clampDateRangeToSubscription(
  range: IsoDateRange,
  clientSubscription: { start_date?: string | null; end_date?: string | null } | null | undefined
): IsoDateRange | null {
  const start = String(clientSubscription?.start_date || '').slice(0, 10);
  const end = String(clientSubscription?.end_date || '').slice(0, 10);

  let periodMin = String(range?.periodMin || '').slice(0, 10);
  let periodMax = String(range?.periodMax || '').slice(0, 10);
  if (!periodMin || !periodMax || periodMin > periodMax) return null;

  if (start) periodMin = maxIsoDate(periodMin, start);
  if (end) periodMax = minIsoDate(periodMax, end);

  return periodMin <= periodMax ? { periodMin, periodMax } : null;
}

export function isIsoDateWithinRange(isoDate: string, range: IsoDateRange | null | undefined): boolean {
  const day = String(isoDate || '').slice(0, 10);
  if (!day || !range?.periodMin || !range?.periodMax) return false;
  return day >= range.periodMin && day <= range.periodMax;
}

export function buildCarryoverMonthlyLimit(
  baseLimitRaw: unknown,
  currentMonthUsageRaw: unknown,
  previousMonthUsageRaw: unknown,
  includePreviousCarryover: boolean = false
): {
  baseLimit: number | null;
  currentMonthUsage: number;
  previousMonthUsage: number;
  carryover: number;
  effectiveLimit: number | null;
  remaining: number | null;
  canBook: boolean;
} {
  const toSafeCount = (value: unknown): number => {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric) || numeric <= 0) return 0;
    return Math.max(0, Math.floor(numeric));
  };

  const currentMonthUsage = toSafeCount(currentMonthUsageRaw);
  const previousMonthUsage = toSafeCount(previousMonthUsageRaw);
  const baseLimit = Number(baseLimitRaw);

  if (!Number.isFinite(baseLimit) || baseLimit <= 0) {
    return {
      baseLimit: null,
      currentMonthUsage,
      previousMonthUsage,
      carryover: 0,
      effectiveLimit: null,
      remaining: null,
      canBook: true,
    };
  }

  const normalizedBaseLimit = Math.max(0, Math.floor(baseLimit));
  const carryover = includePreviousCarryover
    ? Math.max(0, normalizedBaseLimit - previousMonthUsage)
    : 0;
  const effectiveLimit = normalizedBaseLimit + carryover;
  const remaining = Math.max(0, effectiveLimit - currentMonthUsage);

  return {
    baseLimit: normalizedBaseLimit,
    currentMonthUsage,
    previousMonthUsage,
    carryover,
    effectiveLimit,
    remaining,
    canBook: currentMonthUsage < effectiveLimit,
  };
}

/**
 * Soma os "atendimentos extras" (bônus fixo, recorrente por mês) ao limite base do assinante.
 *
 * IMPORTANTE: este bônus é usado APENAS na validação de limite de agendamentos.
 * Ele NUNCA deve ser somado ao `monthly_limit` usado como divisor de repasse financeiro
 * (isso mudaria o valor pago ao profissional). Por isso o bônus vive em coluna separada
 * (`client_subscriptions.bonus_credits`) e só é aplicado aqui.
 *
 * Retorna 0 quando não há limite base (0/null = ilimitado): nesse caso o bônus não faz
 * sentido e o comportamento continua "sem limite".
 */
export function applyBonusCreditsToLimit(baseLimitRaw: unknown, bonusCreditsRaw: unknown): number {
  const base = Number(baseLimitRaw);
  if (!Number.isFinite(base) || base <= 0) return 0;
  const bonus = Number(bonusCreditsRaw);
  const safeBonus = Number.isFinite(bonus) && bonus > 0 ? Math.floor(bonus) : 0;
  return Math.floor(base) + safeBonus;
}
