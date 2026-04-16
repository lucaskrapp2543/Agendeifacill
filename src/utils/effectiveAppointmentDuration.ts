/**
 * Duração efetiva para ocupação de agenda / conflitos de horário.
 * Corrige casos em que agendamento de assinante foi gravado com duration = passo da grade (ex.: 30)
 * mas o plano (divided_services / service_duration) exige mais (ex.: 60).
 */

export type SubscriptionPlanForDuration = {
  id?: string;
  name?: string;
  service_duration?: number;
  divide_services_enabled?: boolean;
  divided_services?: Array<{ name?: string; duration?: number }>;
};

function normalizeName(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function parseDurationPositive(raw: unknown, fallback: number): number {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return Math.round(raw);
  const rawText = String(raw || '').trim();
  if (!rawText) return fallback;
  const direct = Number(rawText);
  if (Number.isFinite(direct) && direct > 0) return Math.round(direct);
  const match = rawText.match(/(\d+)/);
  if (match) {
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return fallback;
}

/** Duração “de catálogo” do plano para este agendamento (0 se não der para inferir). */
export function resolveSubscriberPlanBaseDurationMinutes(
  apt: {
    service?: string;
    subscription_id?: string | null;
    is_subscriber?: boolean;
    client_name?: string;
  },
  subscriptionPlans: SubscriptionPlanForDuration[]
): number {
  const isSubscriberAppointment =
    Boolean(apt?.is_subscriber) ||
    String(apt?.client_name || '').toUpperCase().includes('(ASSINANTE)');
  if (!isSubscriberAppointment || !apt?.service || subscriptionPlans.length === 0) return 0;

  const serviceStr = String(apt.service).trim();
  const normalizedService = normalizeName(serviceStr);
  const aptSubscriptionId = String(apt?.subscription_id || '').trim();

  for (const sub of subscriptionPlans) {
    if (aptSubscriptionId && String(sub?.id || '') !== aptSubscriptionId) continue;
    if (!sub?.divide_services_enabled || !Array.isArray(sub?.divided_services) || sub.divided_services.length === 0) {
      continue;
    }
    const matched = sub.divided_services.find((svc) => {
      const current = normalizeName(String(svc?.name || ''));
      return (
        current &&
        (normalizedService === current ||
          normalizedService.includes(current) ||
          current.includes(normalizedService))
      );
    });
    const d = Number(matched?.duration);
    if (matched && Number.isFinite(d) && d > 0) return Math.round(d);
  }

  const sub = subscriptionPlans.find(
    (s) => s?.name && (serviceStr.includes(String(s.name)) || String(s.name).includes(serviceStr))
  );
  const legacy = Number(sub?.service_duration);
  if (sub && Number.isFinite(legacy) && legacy > 0) return Math.round(legacy);
  return 0;
}

/**
 * Duração base (min) para grade e sobreposição.
 * Assinante: corrige subcontagem típica (stored = passo da grade < plano) sem apagar “Terminei Antes”
 * (duração reduzida que não casa com múltiplos inteiros do passo ou shortfall < passo).
 */
export function getEffectiveAppointmentBaseDurationMinutes(
  apt: {
    duration?: number | string | null;
    service?: string;
    subscription_id?: string | null;
    is_subscriber?: boolean;
    client_name?: string;
  },
  gridIntervalMinutes: number,
  subscriptionPlans: SubscriptionPlanForDuration[]
): number {
  const fallback = parseDurationPositive(apt?.duration, gridIntervalMinutes);
  const isSubscriberAppointment =
    Boolean(apt?.is_subscriber) ||
    String(apt?.client_name || '').toUpperCase().includes('(ASSINANTE)');

  if (!isSubscriberAppointment) {
    return Math.max(1, parseDurationPositive(apt?.duration, gridIntervalMinutes));
  }

  const stored = parseDurationPositive(apt?.duration, 0);
  const planDur = resolveSubscriberPlanBaseDurationMinutes(apt, subscriptionPlans);

  if (planDur > 0 && stored > 0 && stored < planDur) {
    const shortfall = planDur - stored;
    const step = Math.max(1, Math.round(gridIntervalMinutes));
    if (shortfall >= step && stored % step === 0) {
      return planDur;
    }
  }

  if (stored > 0) return stored;
  if (planDur > 0) return planDur;
  return Math.max(1, fallback);
}
