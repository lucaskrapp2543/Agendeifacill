import { supabase } from '../lib/supabase';
import { getWhatsappLookupKeys } from '../lib/subscriberAppointmentFlags';
import {
  computeAfcoinPointsForAppointment,
  isAppointmentEligibleForAfcoins,
  resolveAppointmentPaymentChannel,
} from './appointmentPayment';

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

function registerAfcoinBalanceKey(map: Map<string, number>, rawKey: string, balance: number): void {
  const digits = String(rawKey || '').replace(/\D/g, '');
  if (!digits) return;
  map.set(digits, Math.max(map.get(digits) ?? 0, balance));
  const normalized = normalizeAfcoinPhone(digits);
  if (normalized) map.set(normalized, Math.max(map.get(normalized) ?? 0, balance));
  if (digits.startsWith('55') && digits.length > 2) {
    const local = digits.slice(2);
    map.set(local, Math.max(map.get(local) ?? 0, balance));
  }
  if (!digits.startsWith('55') && digits.length >= 10 && digits.length <= 11) {
    map.set(`55${digits}`, Math.max(map.get(`55${digits}`) ?? 0, balance));
  }
}

/** Índice de saldo por variantes de telefone (mesma regra do RPC / Meus Agendamentos). */
export function buildAfcoinBalanceIndex(
  rows: Array<{ customer_phone?: string | null; balance?: number | null }>
): Map<string, number> {
  const map = new Map<string, number>();
  rows.forEach((row) => {
    const balance = Number(row?.balance || 0);
    if (!Number.isFinite(balance)) return;
    const raw = String(row?.customer_phone || '').trim();
    registerAfcoinBalanceKey(map, raw, balance);
    buildAfcoinPhoneVariants(raw).forEach((variant) => registerAfcoinBalanceKey(map, variant, balance));
    getWhatsappLookupKeys(raw).forEach((variant) => registerAfcoinBalanceKey(map, variant, balance));
  });
  return map;
}

export function lookupAfcoinBalanceInIndex(whatsapp: string, index: Map<string, number>): number {
  let best = 0;
  collectAfcoinPhoneProbeKeys(whatsapp).forEach((key) => {
    if (index.has(key)) best = Math.max(best, index.get(key)!);
  });
  return best;
}

function collectAfcoinPhoneProbeKeys(raw: string): Set<string> {
  const probes = new Set<string>();
  const add = (value: string) => {
    const digits = String(value || '').replace(/\D/g, '');
    if (digits) probes.add(digits);
    const normalized = normalizeAfcoinPhone(value);
    if (normalized) probes.add(normalized);
    if (digits.startsWith('55') && digits.length > 2) probes.add(digits.slice(2));
    if (!digits.startsWith('55') && digits.length >= 10 && digits.length <= 11) {
      probes.add(`55${digits}`);
    }
  };

  add(raw);
  buildAfcoinPhoneVariants(raw).forEach(add);
  getWhatsappLookupKeys(raw).forEach(add);
  return probes;
}

/** Mesma base do "Meus Agendamentos": soma 18/60 por agendamento elegível. */
export function buildAfcoinBalanceByPhoneKeyFromAppointments(
  appointments: any[],
  establishment: unknown
): Map<string, number> {
  const map = new Map<string, number>();
  if (!isClientAfcoinsEnabledForEstablishment(establishment)) return map;
  if (!Array.isArray(appointments)) return map;

  appointments.forEach((apt) => {
    const enriched = {
      ...apt,
      establishments: apt?.establishments || establishment,
    };
    const points = computeAfcoinPointsForAppointment(enriched);
    if (points <= 0) return;

    collectAfcoinPhoneProbeKeys(String(apt?.client_whatsapp || '')).forEach((key) => {
      map.set(key, (map.get(key) || 0) + points);
    });
  });

  return map;
}

export function lookupAfcoinBalanceInPhoneKeyMap(whatsapp: string, map: Map<string, number>): number {
  let best = 0;
  collectAfcoinPhoneProbeKeys(whatsapp).forEach((key) => {
    if (map.has(key)) best = Math.max(best, map.get(key)!);
  });
  return best;
}

/** Saldo exibido = carteira persistida OU soma dos agendamentos (o que o cliente já vê). */
export function resolveClientAfcoinBalanceDisplay(params: {
  whatsapp: string;
  walletIndex: Map<string, number>;
  appointmentIndex: Map<string, number>;
}): number {
  const wallet = lookupAfcoinBalanceInIndex(params.whatsapp, params.walletIndex);
  const fromAppointments = lookupAfcoinBalanceInPhoneKeyMap(params.whatsapp, params.appointmentIndex);
  return Math.max(wallet, fromAppointments);
}

/** Carrega saldos AFCoins do estabelecimento (tabela + RPC por telefone dos clientes). */
export async function loadEstablishmentAfcoinBalanceIndex(
  establishmentId: string,
  clientPhones: string[]
): Promise<Map<string, number>> {
  const estId = String(establishmentId || '').trim();
  if (!estId) return new Map();

  const index = new Map<string, number>();
  const mergeRows = (rows: Array<{ customer_phone?: string | null; balance?: number | null }>) => {
    buildAfcoinBalanceIndex(rows).forEach((balance, key) => {
      index.set(key, Math.max(index.get(key) ?? 0, balance));
    });
  };

  try {
    const pageSize = 1000;
    let from = 0;
    const directRows: Array<{ customer_phone?: string; balance?: number }> = [];
    while (true) {
      const { data, error } = await supabase
        .from('afcoin_wallets')
        .select('customer_phone, balance')
        .eq('establishment_id', estId)
        .range(from, from + pageSize - 1);

      if (error) {
        console.warn('AFCoins: falha ao listar carteiras do estabelecimento:', error.message);
        break;
      }
      const batch = Array.isArray(data) ? data : [];
      directRows.push(...batch);
      if (batch.length < pageSize) break;
      from += pageSize;
    }
    mergeRows(directRows);
  } catch (error) {
    console.warn('AFCoins: erro ao listar carteiras do estabelecimento:', error);
  }

  const normalizedPhones = new Set<string>();
  clientPhones.forEach((phone) => {
    buildAfcoinPhoneVariants(phone).forEach((variant) => {
      const normalized = normalizeAfcoinPhone(variant);
      if (normalized) normalizedPhones.add(normalized);
    });
  });

  const phones = Array.from(normalizedPhones);
  const chunkSize = 120;
  for (let i = 0; i < phones.length; i += chunkSize) {
    const chunk = phones.slice(i, i + chunkSize);
    const rpcRows = await fetchAfcoinClientWallets({ establishmentIds: [estId], phoneVariants: chunk });
    mergeRows(
      rpcRows.map((row) => ({
        customer_phone: row.customer_phone,
        balance: row.balance,
      }))
    );
  }

  return index;
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
