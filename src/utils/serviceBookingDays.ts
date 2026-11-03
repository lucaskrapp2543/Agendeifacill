/**
 * Dias em que o CLIENTE pode agendar um serviço pelo link público (pedido da 7584: corte infantil
 * só nos dias mais tranquilos). Campo opcional service_subcategories.booking_weekdays.
 *
 * Vazio ou ausente = todos os dias, então quem não usa a opção não muda nada.
 * Vale só para o agendamento do cliente: no painel, Reservar e Encaixe continuam livres.
 */
export const BOOKING_WEEKDAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

const WEEKDAY_LABEL: Record<string, string> = {
  sunday: 'domingo',
  monday: 'segunda',
  tuesday: 'terça',
  wednesday: 'quarta',
  thursday: 'quinta',
  friday: 'sexta',
  saturday: 'sábado',
};

/** Normaliza o valor salvo. Retorna null quando o serviço não tem trava de dia. */
export function parseServiceBookingWeekdays(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const valid = raw
    .map((day) => String(day || '').toLowerCase().trim())
    .filter((day) => (BOOKING_WEEKDAY_KEYS as readonly string[]).includes(day));
  return valid.length > 0 ? Array.from(new Set(valid)) : null;
}

/**
 * Dias que servem para TODOS os serviços escolhidos.
 * null = nenhum deles tem trava. [] = os serviços escolhidos não têm nenhum dia em comum.
 */
export function getCommonBookingWeekdays(services: unknown): string[] | null {
  const list = Array.isArray(services) ? services : [];
  let common: string[] | null = null;
  for (const service of list) {
    const days = parseServiceBookingWeekdays((service as any)?.booking_weekdays);
    if (!days) continue;
    common = common === null ? days : common.filter((day) => days.includes(day));
  }
  return common;
}

/** O(s) serviço(s) pode(m) ser agendado(s) neste dia da semana? Aceita Date ou 'yyyy-MM-dd'. */
export function isBookingDayAllowedForServices(services: unknown, date: Date | string): boolean {
  const common = getCommonBookingWeekdays(services);
  if (common === null) return true;
  const parsed = typeof date === 'string' ? new Date(`${date.slice(0, 10)}T12:00:00`) : date;
  if (Number.isNaN(parsed.getTime())) return true;
  return common.includes(BOOKING_WEEKDAY_KEYS[parsed.getDay()]);
}

/** Texto simples para o cliente: "terça e quarta". Em ordem de segunda a domingo. */
export function formatBookingWeekdays(days: string[] | null | undefined): string {
  const order = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const labels = order.filter((day) => (days || []).includes(day)).map((day) => WEEKDAY_LABEL[day]);
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} e ${labels[labels.length - 1]}`;
}
