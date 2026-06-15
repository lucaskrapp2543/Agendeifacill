export type ClientSubscriptionRowLite = {
  id?: string | null;
  subscription_id?: string | null;
  payment_status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  subscriber_name?: string | null;
  subscriber_whatsapp?: string | null;
  client_name_override?: string | null;
  client_whatsapp?: string | null;
};

export type SubscriberAppointmentLike = {
  id?: string | null;
  client_name?: string | null;
  client_whatsapp?: string | null;
  appointment_date?: string | null;
  price?: number | null;
  total_price?: number | null;
  payment_method?: string | null;
  is_subscriber?: unknown;
  is_loyalty_reward?: unknown;
  subscription_id?: string | null;
  subscriber_service_id?: string | null;
  subscriber_service_name?: string | null;
  service?: string | null;
  status?: string | null;
};

export function parseSubscriberBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const raw = String(value ?? '').trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 't' || raw === 'yes' || raw === 'sim' || raw === 'on';
}

export function normalizeSubscriberPhoneDigits(value: unknown): string {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) return digits.slice(2);
  return digits;
}

export function getWhatsappLookupKeys(raw: string): string[] {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return [];

  const local = digits.startsWith('55') && digits.length > 2 ? digits.slice(2) : digits;
  const localVariants = new Set<string>([local]);
  if (local.length === 10) {
    localVariants.add(`${local.slice(0, 2)}9${local.slice(2)}`);
  }
  if (local.length === 11 && local.slice(2, 3) === '9') {
    localVariants.add(`${local.slice(0, 2)}${local.slice(3)}`);
  }

  const out = new Set<string>();
  localVariants.forEach((x) => {
    const clean = String(x || '').replace(/\D/g, '');
    if (!clean) return;
    out.add(clean);
    out.add(`55${clean}`);
  });
  return Array.from(out);
}

export function normalizeSubscriberNameKey(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\(assinante\)/gi, '')
    .replace(/👑/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function isStrictSubscriberAppointment(apt: SubscriberAppointmentLike | null | undefined): boolean {
  if (!apt) return false;
  if (parseSubscriberBoolean(apt.is_loyalty_reward)) return false;

  const baseServicePrice = Number(apt.price ?? 0);
  if (!Number.isFinite(baseServicePrice) || baseServicePrice > 0) return false;

  if (parseSubscriberBoolean(apt.is_subscriber)) return true;
  if (clientNameHasSubscriberLabel(apt.client_name)) return true;

  const paymentMethod = String(apt.payment_method || '').trim().toLowerCase();
  if (paymentMethod === 'assinante') return true;

  if (String(apt.subscriber_service_id || '').trim()) return true;
  if (String(apt.subscriber_service_name || '').trim()) return true;

  return false;
}

export function isSubscriberAppointmentFromFields(apt: SubscriberAppointmentLike | null | undefined): boolean {
  return isStrictSubscriberAppointment(apt);
}

/** Label "(ASSINANTE)" persistido ou visível no nome do cliente na agenda. */
export function clientNameHasSubscriberLabel(clientName: unknown): boolean {
  return /\(\s*assinante\s*\)/i.test(String(clientName || '').trim());
}

/**
 * Mesma regra visual da agenda (card com "(ASSINANTE)" + R$ 0 no serviço):
 * - Concluído
 * - price (serviço base) = R$ 0 — extra/produto pode aumentar total_price
 * - is_subscriber OU "(ASSINANTE)" no nome OU payment_method = assinante
 * NÃO entra: match por telefone/plano/subscription_id sozinho.
 */
export function isSubscriberAppointmentForProfessionalControl(
  apt: SubscriberAppointmentLike | null | undefined
): boolean {
  if (!apt) return false;
  if (String(apt.status || '').trim().toLowerCase() !== 'completed') return false;
  return isStrictSubscriberAppointment(apt);
}

/** @deprecated Use isSubscriberAppointmentForProfessionalControl */
export function isStrictSubscriberAppointmentForProfessionalControl(
  apt: SubscriberAppointmentLike | null | undefined
): boolean {
  return isSubscriberAppointmentForProfessionalControl(apt);
}

export function isDateInsidePaidSubscription(aptDateRaw: unknown, sub: ClientSubscriptionRowLite): boolean {
  const aptDate = String(aptDateRaw || '').slice(0, 10);
  const startDate = String(sub?.start_date || '').slice(0, 10);
  const endDate = String(sub?.end_date || '').slice(0, 10);
  if (!aptDate) return false;
  if (startDate && startDate > aptDate) return false;
  if (endDate && endDate < aptDate) return false;
  return String(sub?.payment_status || '').toLowerCase().trim() === 'paid';
}

export function buildSubscriptionsByPhoneMap(rows: ClientSubscriptionRowLite[]): Map<string, ClientSubscriptionRowLite[]> {
  const map = new Map<string, ClientSubscriptionRowLite[]>();
  rows.forEach((row) => {
    const phoneKeys = [
      ...getWhatsappLookupKeys(String(row?.subscriber_whatsapp || '')),
      ...getWhatsappLookupKeys(String(row?.client_whatsapp || '')),
    ]
      .map((key) => normalizeSubscriberPhoneDigits(key))
      .filter(Boolean);

    phoneKeys.forEach((key) => {
      const list = map.get(key) || [];
      list.push(row);
      map.set(key, list);
    });
  });
  return map;
}

export function buildSubscriptionsByNameMap(rows: ClientSubscriptionRowLite[]): Map<string, ClientSubscriptionRowLite[]> {
  const map = new Map<string, ClientSubscriptionRowLite[]>();
  rows.forEach((row) => {
    const names = [
      row?.subscriber_name,
      row?.client_name_override,
    ]
      .map((name) => normalizeSubscriberNameKey(name))
      .filter(Boolean);

    names.forEach((key) => {
      const list = map.get(key) || [];
      list.push(row);
      map.set(key, list);
    });
  });
  return map;
}

export function findMatchingSubscriptionForAppointment(
  apt: SubscriberAppointmentLike,
  subscriptionsByPhone: Map<string, ClientSubscriptionRowLite[]>,
  subscriptionsByName: Map<string, ClientSubscriptionRowLite[]>
): ClientSubscriptionRowLite | null {
  const aptKeys = getWhatsappLookupKeys(String(apt?.client_whatsapp || ''))
    .map((key) => normalizeSubscriberPhoneDigits(key))
    .filter(Boolean);

  for (const key of aptKeys) {
    const matched = (subscriptionsByPhone.get(key) || []).find((sub) =>
      isDateInsidePaidSubscription(apt?.appointment_date, sub)
    );
    if (matched) return matched;
  }

  const nameKey = normalizeSubscriberNameKey(apt?.client_name);
  if (nameKey) {
    const matched = (subscriptionsByName.get(nameKey) || []).find((sub) =>
      isDateInsidePaidSubscription(apt?.appointment_date, sub)
    );
    if (matched) return matched;
  }

  return null;
}

export function enrichAppointmentsWithSubscriberFlags<T extends SubscriberAppointmentLike>(
  appointments: T[],
  subscriptionRows: ClientSubscriptionRowLite[] = []
): T[] {
  if (!Array.isArray(appointments) || appointments.length === 0) return appointments;

  const subscriptionsByPhone = buildSubscriptionsByPhoneMap(subscriptionRows);
  const subscriptionsByName = buildSubscriptionsByNameMap(subscriptionRows);

  return appointments.map((apt) => {
    const next = { ...apt } as T & SubscriberAppointmentLike;
    next.is_subscriber = isStrictSubscriberAppointment(next);

    if (!next.is_subscriber) {
      return next as T;
    }

    if (!String(next.subscription_id || '').trim()) {
      const matchedSubscription = findMatchingSubscriptionForAppointment(next, subscriptionsByPhone, subscriptionsByName);
      if (matchedSubscription) {
        next.subscription_id =
          String(matchedSubscription?.subscription_id || matchedSubscription?.id || '').trim() || null;
      }
    }

    const paymentMethod = String(next.payment_method || '').toLowerCase().trim();
    if (paymentMethod !== 'assinante') {
      next.payment_method = 'assinante';
    }

    return next as T;
  });
}

export function mergeAppointmentPreservingSubscriberFlags<T extends SubscriberAppointmentLike>(
  current: T,
  incoming: T
): T {
  const merged = { ...current, ...incoming } as T;
  const shouldBeSubscriber =
    isSubscriberAppointmentFromFields(current) ||
    isSubscriberAppointmentFromFields(incoming) ||
    isSubscriberAppointmentFromFields(merged);

  if (!shouldBeSubscriber) return merged;

  merged.is_subscriber = true;
  const paymentMethod = String(merged.payment_method || '').trim().toLowerCase();
  if (paymentMethod !== 'assinante') {
    merged.payment_method = 'assinante';
  }
  merged.subscription_id =
    String(merged.subscription_id || '').trim() ||
    String(current.subscription_id || '').trim() ||
    String(incoming.subscription_id || '').trim() ||
    null;
  merged.subscriber_service_id =
    String(merged.subscriber_service_id || '').trim() ||
    String(current.subscriber_service_id || '').trim() ||
    String(incoming.subscriber_service_id || '').trim() ||
    null;
  merged.subscriber_service_name =
    String(merged.subscriber_service_name || '').trim() ||
    String(current.subscriber_service_name || '').trim() ||
    String(incoming.subscriber_service_name || '').trim() ||
    null;

  return merged;
}

export function sanitizeAppointmentServiceDisplay(service: unknown): string {
  const raw = String(service || '').trim();
  if (!raw) return raw;
  return raw
    .replace(/\(\s*undefined\s*\)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+-\s+-\s+/g, ' - ')
    .replace(/\s+-\s*$/g, '')
    .trim();
}

export function shouldAutoRegisterSubscriberAttendanceFromAppointment(apt: SubscriberAppointmentLike): boolean {
  return isSubscriberAppointmentForProfessionalControl(apt);
}

/** Forma de pagamento efetiva para exibição/financeiro (vazio → dinheiro em avulsos). */
export function resolveEffectivePaymentMethod(apt: SubscriberAppointmentLike | null | undefined): string {
  if (isStrictSubscriberAppointment(apt)) {
    const method = String(apt?.payment_method || '').trim().toLowerCase();
    return method === 'assinante' ? 'assinante' : method || 'assinante';
  }

  const method = String(apt?.payment_method || '').trim().toLowerCase();
  if (!method || method === 'pendente' || method === 'assinante') return 'dinheiro';
  return method;
}

/** Ao concluir avulso sem forma definida (ou com assinante inconsistente), gravar dinheiro. */
export function buildCompletionPaymentPatch(
  apt: SubscriberAppointmentLike | null | undefined
): Record<string, unknown> {
  if (!apt || isStrictSubscriberAppointment(apt)) return {};

  const method = String(apt.payment_method || '').trim().toLowerCase();
  if (method && method !== 'pendente' && method !== 'assinante') return {};

  const patch: Record<string, unknown> = { payment_method: 'dinheiro' };
  if (parseSubscriberBoolean(apt.is_subscriber)) {
    patch.is_subscriber = false;
  }
  return patch;
}
