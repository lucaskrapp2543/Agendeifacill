import { supabase } from '../lib/supabase';
import { isAppointmentEligibleForAfcoins, resolveAppointmentPaymentChannel } from './appointmentPayment';

export type AfcoinBookingRule =
  | 'name_phone_5'
  | 'booking_confirm_10'
  | 'local_bonus_3'
  | 'local_total_18'
  | 'local_total_10'
  | 'online_bonus_45'
  | 'online_total_60';

export const AFCOIN_REDEEM_THRESHOLD = 1000;

export const AFCOIN_EARN_HINT =
  'Ganhe +5 ao informar telefone, +10 ao confirmar horário, +18 pagando no estabelecimento (5+10+3) ou muito mais pagando online. Válido para agendamentos a partir de 08/06/2026.';

/** Estabelecimento participa do programa AFCoins para clientes (default: sim). */
export function isClientAfcoinsEnabledForEstablishment(establishment: unknown): boolean {
  if (!establishment || typeof establishment !== 'object') return true;
  const raw = (establishment as { client_afcoins_enabled?: boolean | null }).client_afcoins_enabled;
  if (raw === undefined || raw === null) return true;
  return Boolean(raw);
}

/** Mesma lógica do SQL afcoin_normalize_phone */
export function normalizeAfcoinPhone(raw: string): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if ([12, 13].includes(digits.length) && digits.startsWith('55')) {
    return digits.slice(2);
  }
  return digits;
}

export function buildAfcoinPhoneVariants(raw: string): string[] {
  const normalized = normalizeAfcoinPhone(raw);
  if (!normalized) return [];
  const candidates = new Set<string>([normalized]);
  if (!normalized.startsWith('55')) candidates.add(`55${normalized}`);
  if (normalized.length === 10) candidates.add(`${normalized.slice(0, 2)}9${normalized.slice(2)}`);
  if (normalized.length === 11 && normalized.charAt(2) === '9') {
    candidates.add(`${normalized.slice(0, 2)}${normalized.slice(3)}`);
  }
  return Array.from(candidates);
}

export async function registerAfcoinBookingEvent(params: {
  establishmentId: string;
  appointmentId?: string | null;
  clientPhone: string;
  clientName: string;
  rule: AfcoinBookingRule;
  paymentId?: string | null;
  metadata?: Record<string, unknown>;
  establishment?: unknown;
}): Promise<boolean> {
  const establishmentId = String(params.establishmentId || '').trim();
  const clientPhone = normalizeAfcoinPhone(params.clientPhone);
  if (!establishmentId || !clientPhone) return false;
  if (params.establishment && !isClientAfcoinsEnabledForEstablishment(params.establishment)) {
    return false;
  }

  try {
    const { data, error } = await supabase.rpc('afcoin_register_booking_event', {
      p_establishment_id: establishmentId,
      p_appointment_id: params.appointmentId ?? null,
      p_client_phone: clientPhone,
      p_client_name: String(params.clientName || 'Cliente').trim() || 'Cliente',
      p_rule: params.rule,
      p_payment_id: params.paymentId ?? null,
      p_metadata: params.metadata ?? {},
    });

    if (error) {
      const msg = String(error.message || '').toLowerCase();
      const missingRpc =
        msg.includes('afcoin_register_booking_event') &&
        (msg.includes('does not exist') || msg.includes('could not find') || msg.includes('schema cache'));
      if (!missingRpc) {
        console.warn('AFCoins: falha ao registrar pontos:', error.message, error.details, error.hint);
      }
      return false;
    }

    return Boolean(data);
  } catch (error) {
    console.warn('AFCoins: erro inesperado ao registrar pontos:', error);
    return false;
  }
}

type AfcoinBundleParams = {
  establishmentId: string;
  appointmentId?: string | null;
  clientPhone: string;
  clientName: string;
  paymentId?: string | null;
  establishment?: unknown;
};

/** Garante 5 + 10 + 3 ao pagar no local (18 total). Idempotente por regra/agendamento. */
export async function registerAfcoinLocalPayBundle(params: AfcoinBundleParams): Promise<number> {
  const rules: AfcoinBookingRule[] = ['name_phone_5', 'booking_confirm_10', 'local_bonus_3'];
  let awarded = 0;
  for (const rule of rules) {
    const ok = await registerAfcoinBookingEvent({ ...params, rule });
    if (ok) {
      if (rule === 'name_phone_5') awarded += 5;
      if (rule === 'booking_confirm_10') awarded += 10;
      if (rule === 'local_bonus_3') awarded += 3;
    }
  }
  return awarded;
}

export type AfcoinClientWalletRow = {
  establishment_id: string;
  customer_phone: string;
  balance: number;
  online_payments_count: number;
  local_payments_count: number;
  updated_at?: string;
};

/** Leitura de saldo via RPC (security definer) — funciona mesmo sem GRANT direto na tabela. */
export async function fetchAfcoinClientWallets(params: {
  establishmentIds: string[];
  phoneVariants: string[];
}): Promise<AfcoinClientWalletRow[]> {
  const establishmentIds = params.establishmentIds.map((id) => String(id || '').trim()).filter(Boolean);
  const phoneVariants = params.phoneVariants.map((p) => String(p || '').trim()).filter(Boolean);
  if (establishmentIds.length === 0 || phoneVariants.length === 0) return [];

  try {
    const { data, error } = await supabase.rpc('afcoin_get_client_wallets', {
      p_establishment_ids: establishmentIds,
      p_phone_variants: phoneVariants,
    });

    if (error) {
      const msg = String(error.message || '').toLowerCase();
      const missingRpc =
        msg.includes('afcoin_get_client_wallets') &&
        (msg.includes('does not exist') || msg.includes('could not find') || msg.includes('schema cache'));
      if (!missingRpc) {
        console.warn('AFCoins: falha ao buscar carteiras:', error.message, error.details, error.hint);
      }
      return [];
    }

    if (!Array.isArray(data)) return [];
    return data.map((row: any) => ({
      establishment_id: String(row?.establishment_id || ''),
      customer_phone: String(row?.customer_phone || ''),
      balance: Number(row?.balance || 0),
      online_payments_count: Number(row?.online_payments_count || 0),
      local_payments_count: Number(row?.local_payments_count || 0),
      updated_at: row?.updated_at ? String(row.updated_at) : undefined,
    }));
  } catch (error) {
    console.warn('AFCoins: erro inesperado ao buscar carteiras:', error);
    return [];
  }
}

export { isLocalAfcoinPaymentMethod } from './appointmentPayment';

/** Sincroniza AFCoins retroativamente com base no pagamento REAL (sistema vs local). */
export async function syncAfcoinsFromAppointments(
  appointments: any[],
  clientPhone: string
): Promise<void> {
  const phone = normalizeAfcoinPhone(clientPhone);
  if (!phone || !Array.isArray(appointments) || appointments.length === 0) return;

  for (const appointment of appointments) {
    if (!isAppointmentEligibleForAfcoins(appointment)) continue;

    if (!isClientAfcoinsEnabledForEstablishment(appointment?.establishments)) continue;

    const establishmentId = String(appointment?.establishment_id || appointment?.establishments?.id || '').trim();
    const appointmentId = String(appointment?.id || '').trim();
    if (!establishmentId || !appointmentId) continue;

    const status = String(appointment?.status || '').trim().toLowerCase();
    if (status === 'cancelled') continue;

    const channel = resolveAppointmentPaymentChannel(appointment);
    const appointmentPhone = normalizeAfcoinPhone(
      String(appointment?.client_whatsapp || appointment?.client_phone || clientPhone || '')
    );
    const params = {
      establishmentId,
      appointmentId,
      clientPhone: appointmentPhone || phone,
      clientName: String(appointment?.client_name || 'Cliente').trim() || 'Cliente',
      paymentId: String(appointment?.payment_transaction_id || '').trim() || null,
      metadata: { origin: 'view_appointments_sync', channel },
      establishment: appointment?.establishments,
    };

    if (channel === 'system_online_pix' || channel === 'system_online_card') {
      await registerAfcoinOnlinePayBundle(params);
      continue;
    }

    if (channel === 'local_establishment') {
      await registerAfcoinLocalPayBundle(params);
    }
  }
}

/** Garante 5 + 10 + 45 ao pagar online via PIX/cartão (60 total). */
export async function registerAfcoinOnlinePayBundle(params: AfcoinBundleParams): Promise<number> {
  const rules: AfcoinBookingRule[] = ['name_phone_5', 'booking_confirm_10', 'online_bonus_45'];
  let awarded = 0;
  for (const rule of rules) {
    const ok = await registerAfcoinBookingEvent({ ...params, rule });
    if (ok) {
      if (rule === 'name_phone_5') awarded += 5;
      if (rule === 'booking_confirm_10') awarded += 10;
      if (rule === 'online_bonus_45') awarded += 45;
    }
  }
  return awarded;
}
