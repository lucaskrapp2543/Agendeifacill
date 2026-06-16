const APPOINTMENTS_DAY_CACHE_PREFIX = 'agenda_day_cache_v1';
const APPOINTMENTS_DAY_CACHE_TTL_MS = 45 * 60 * 1000;
const APPOINTMENTS_DAY_CACHE_MAX_ITEMS = 200;

type AppointmentsDayCacheEntry = {
  savedAt: number;
  establishmentId: string;
  dateKey: string;
  appointments: unknown[];
};

const buildAppointmentsDayCacheKey = (establishmentId: string, dateKey: string): string =>
  `${APPOINTMENTS_DAY_CACHE_PREFIX}:${establishmentId}:${dateKey}`;

/** Lê cache leve da agenda do dia (sessionStorage — só nesta aba, expira em ~45 min). */
export function readAppointmentsDayCache(establishmentId: string, dateKey: string): unknown[] | null {
  const establishmentKey = String(establishmentId || '').trim();
  const dayKey = String(dateKey || '').slice(0, 10);
  if (!establishmentKey || !dayKey || typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(buildAppointmentsDayCacheKey(establishmentKey, dayKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppointmentsDayCacheEntry;
    if (!parsed || !Array.isArray(parsed.appointments) || parsed.appointments.length === 0) return null;
    if (Date.now() - Number(parsed.savedAt || 0) > APPOINTMENTS_DAY_CACHE_TTL_MS) return null;
    if (String(parsed.establishmentId || '') !== establishmentKey) return null;
    if (String(parsed.dateKey || '').slice(0, 10) !== dayKey) return null;
    return parsed.appointments;
  } catch {
    return null;
  }
}

export function writeAppointmentsDayCache(
  establishmentId: string,
  dateKey: string,
  appointments: unknown[]
): void {
  const establishmentKey = String(establishmentId || '').trim();
  const dayKey = String(dateKey || '').slice(0, 10);
  if (!establishmentKey || !dayKey || typeof window === 'undefined') return;
  if (!Array.isArray(appointments) || appointments.length === 0) return;

  try {
    const entry: AppointmentsDayCacheEntry = {
      savedAt: Date.now(),
      establishmentId: establishmentKey,
      dateKey: dayKey,
      appointments: appointments.slice(0, APPOINTMENTS_DAY_CACHE_MAX_ITEMS),
    };
    window.sessionStorage.setItem(
      buildAppointmentsDayCacheKey(establishmentKey, dayKey),
      JSON.stringify(entry)
    );
  } catch {
    // Quota ou modo privado — ignora sem quebrar fluxo.
  }
}
