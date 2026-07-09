/**
 * Sistema independente de assinantes
 * Não depende da lista de clientes existentes
 */

import { v4 as uuidv4 } from 'uuid';
import { ensureManualClientFromContact } from './manualClientsSync';
import {
  buildSubscriptionsByNameMap,
  buildSubscriptionsByPhoneMap,
  EXPLICIT_AVULSO_PAYMENT_METHODS,
  findMatchingSubscriptionForAppointment,
  findMatchingSubscriptionRelaxed,
  isSubscriberAppointmentForProfessionalControl,
  normalizeSubscriberNameKey,
  parseSubscriberBoolean
} from './subscriberAppointmentFlags';
import { supabase } from './supabase';

export interface SubscriberData {
  id: string;
  name: string;
  whatsapp: string;
  email?: string;
  subscription_name: string;
  subscription_value: number;
  start_date: string;
  end_date: string;
  payment_status: string;
}

export interface CreateSubscriberData {
  name: string;
  whatsapp: string;
  email?: string;
  subscription_id: string;
  establishment_id: string;
  start_date: string;
  end_date: string;
  payment_method?: string;
  observation?: string;
  payment_status?: 'paid' | 'unpaid';
  professional_id?: string | null;
  professional_name?: string | null;
}

const normalizeSubscriberWhatsapp = (value: string): string => {
  const digits = String(value || '').replace(/\D/g, '');
  // Padrao interno: DDD + numero, sem 55.
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits.slice(2);
  }
  return digits;
};

const findExistingSubscriberByPhone = async (establishmentId: string, normalizedWhatsapp: string) => {
  const estId = String(establishmentId || '').trim();
  const phone = String(normalizedWhatsapp || '').trim();
  if (!estId || !phone) return { data: null, error: null };

  const attempts: Array<'subscriber_whatsapp' | 'client_whatsapp'> = ['subscriber_whatsapp', 'client_whatsapp'];
  let lastError: any = null;

  for (const column of attempts) {
    const { data, error } = await supabase
      .from('client_subscriptions')
      .select('id, subscription_id, created_at')
      .eq('establishment_id', estId)
      // @ts-expect-error colunas legadas podem não existir no tipo
      .eq(column, phone)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data?.id) {
      return { data, error: null };
    }
    if (error) {
      lastError = error;
    }
  }

  return { data: null, error: lastError };
};

/**
 * Criar um novo assinante independente
 */
export const createIndependentSubscriber = async (data: CreateSubscriberData) => {
  try {
    console.log('🆕 Criando assinante independente:', data);
    const normalizedWhatsapp = normalizeSubscriberWhatsapp(data.whatsapp);
    const normalizedObservation = String(data.observation || '').trim().slice(0, 150);
    const paymentStatus: 'paid' | 'unpaid' = data.payment_status === 'paid' ? 'paid' : 'unpaid';
    const basePayload: any = {
      client_id: uuidv4(), // Gerar UUID válido para assinantes
      subscription_id: data.subscription_id,
      establishment_id: data.establishment_id,
      start_date: data.start_date,
      end_date: data.end_date,
      payment_status: paymentStatus,
      last_payment_date: paymentStatus === 'paid'
        ? String(data.start_date || '').trim().slice(0, 10) || new Date().toISOString().split('T')[0]
        : null,
      // Novos campos para dados completos do assinante
      subscriber_name: data.name,
      subscriber_whatsapp: normalizedWhatsapp,
      subscriber_email: data.email || null,
      subscriber_payment_method: String(data.payment_method || '').trim() || null,
      subscriber_observation: normalizedObservation || null,
      subscriber_professional_id: String(data.professional_id || '').trim() || null,
      subscriber_professional_name: String(data.professional_name || '').trim() || null,
    };
    const updatePayload: any = { ...basePayload };
    delete updatePayload.client_id;
    // Reativar assinante se estava desativado/arquivado (limpar flags)
    updatePayload.deactivated_at = null;
    updatePayload.archived_at = null;

    const { data: existing, error: existingLookupError } = await findExistingSubscriberByPhone(
      data.establishment_id,
      normalizedWhatsapp
    );
    if (existingLookupError) {
      console.warn('⚠️ Não foi possível checar assinante existente antes de salvar:', existingLookupError);
    }

    let result: any = null;
    let error: any = null;

    if (existing?.id) {
      ({ data: result, error } = await supabase
        .from('client_subscriptions')
        .update(updatePayload)
        .eq('id', String(existing.id))
        .select(`
          *,
          subscriptions (name, value, duration_months)
        `)
        .single());
    } else {
      ({ data: result, error } = await supabase
        .from('client_subscriptions')
        .insert([basePayload])
        .select(`
          *,
          subscriptions (name, value, duration_months)
        `)
        .single());
    }

    const errMsg = String(error?.message || '').toLowerCase();
    if (
      error &&
      (
        errMsg.includes('subscriber_payment_method') ||
        errMsg.includes('subscriber_observation') ||
        errMsg.includes('subscriber_professional_id') ||
        errMsg.includes('subscriber_professional_name') ||
        errMsg.includes('deactivated_at') ||
        errMsg.includes('archived_at')
      )
    ) {
      const fallbackBasePayload: any = { ...basePayload };
      const fallbackUpdatePayload: any = { ...updatePayload };
      delete fallbackBasePayload.subscriber_payment_method;
      delete fallbackBasePayload.subscriber_observation;
      delete fallbackBasePayload.subscriber_professional_id;
      delete fallbackBasePayload.subscriber_professional_name;
      delete fallbackUpdatePayload.subscriber_payment_method;
      delete fallbackUpdatePayload.subscriber_observation;
      delete fallbackUpdatePayload.subscriber_professional_id;
      delete fallbackUpdatePayload.subscriber_professional_name;
      delete fallbackUpdatePayload.deactivated_at;
      delete fallbackUpdatePayload.archived_at;
      if (existing?.id) {
        ({ data: result, error } = await supabase
          .from('client_subscriptions')
          .update(fallbackUpdatePayload)
          .eq('id', String(existing.id))
          .select(`
            *,
            subscriptions (name, value, duration_months)
          `)
          .single());
      } else {
        ({ data: result, error } = await supabase
          .from('client_subscriptions')
          .insert([fallbackBasePayload])
          .select(`
            *,
            subscriptions (name, value, duration_months)
          `)
          .single());
      }
    }

    if (error) {
      console.error('❌ Erro ao criar assinante:', error);
      throw error;
    }

    // Espelha automaticamente em "Meus Clientes" (manual_clients).
    try {
      await ensureManualClientFromContact({
        establishmentId: data.establishment_id,
        name: data.name,
        whatsapp: normalizedWhatsapp,
      });
    } catch (syncError) {
      console.warn('⚠️ Assinante salvo, mas falhou ao espelhar em Meus Clientes:', syncError);
    }

    console.log('✅ Assinante criado com sucesso:', result);
    return { data: result, error: null };
  } catch (error) {
    console.error('❌ Erro ao criar assinante independente:', error);
    return { data: null, error };
  }
};

/**
 * Verificar se um WhatsApp é de assinante ativo
 */
export const checkWhatsAppSubscriber = async (whatsapp: string, establishmentId: string) => {
  try {
    console.log('🔍 MOBILE DEBUG - Verificando se WhatsApp é assinante (novo sistema):', {
      whatsapp,
      establishmentId,
      userAgent: navigator.userAgent,
      isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    });

    // Normalizar o número (remover caracteres não numéricos)
    const normalizedWhatsapp = whatsapp.replace(/\D/g, '');

    // SOLUÇÃO: Usar função RPC que funciona sem autenticação
    console.log('🔍 Tentando função RPC para verificar assinante...');
    const { data, error } = await supabase
      .rpc('check_subscriber_by_whatsapp', {
        p_whatsapp: normalizedWhatsapp,
        p_establishment_id: establishmentId
      });

    if (error) {
      console.error('❌ Erro ao verificar assinante via RPC:', error);
      return { data: null, error };
    }

    console.log('📋 Resultado da verificação RPC:', data);

    // Se encontrou assinante
    if (data && data.length > 0) {
      const subscriber = data[0];

      console.log('🔍 DEBUG - Dados completos do assinante:', subscriber);
      console.log('🔍 DEBUG - Weekdays recebidos:', subscriber.weekdays);
      console.log('🔍 DEBUG - Subscription name:', subscriber.subscription_name);

      if (subscriber.is_expired) {
        console.log('⚠️ Assinante vencido encontrado:', subscriber);
        return {
          data: {
            ...subscriber,
            is_expired: true,
            expiration_message: subscriber.expiration_message
          },
          error: null
        };
      } else {
        console.log('✅ Assinante ativo encontrado:', subscriber);
        return { data: subscriber, error: null };
      }
    }

    console.log('❌ Nenhum assinante encontrado para WhatsApp:', whatsapp);
    return { data: null, error: null };
  } catch (error) {
    console.error('❌ Erro na verificação de assinante:', error);
    return { data: null, error };
  }
};

/**
 * Buscar assinante por WhatsApp
 */
export const getSubscriberByWhatsapp = async (whatsapp: string, establishmentId: string) => {
  try {
    console.log('🔍 Buscando assinante por WhatsApp:', { whatsapp, establishmentId });

    const normalizedWhatsapp = whatsapp.replace(/\D/g, '');

    const { data, error } = await supabase
      .rpc('get_subscriber_by_whatsapp', {
        p_whatsapp: normalizedWhatsapp,
        p_establishment_id: establishmentId
      });

    if (error) {
      console.error('❌ Erro ao buscar assinante:', error);
      return { data: null, error };
    }

    const result = data?.[0];
    console.log('📋 Assinante encontrado:', result);

    return { data: result, error: null };
  } catch (error) {
    console.error('❌ Erro ao buscar assinante por WhatsApp:', error);
    return { data: null, error };
  }
};

/**
 * Buscar todos os assinantes de um estabelecimento
 */
export const getEstablishmentSubscribers = async (establishmentId: string) => {
  try {
    const { data, error } = await supabase
      .from('client_subscriptions')
      .select(`
        *,
        subscriptions (name, value, duration_months, divide_services_enabled, divided_services)
      `)
      .eq('establishment_id', establishmentId)
      .not('subscriber_name', 'is', null)
      .not('subscriber_whatsapp', 'is', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Erro ao buscar assinantes:', error);
      return { data: null, error };
    }

    return { data: data || [], error: null };
  } catch (error) {
    console.error('❌ Erro ao buscar assinantes do estabelecimento:', error);
    return { data: null, error };
  }
};

/**
 * Atualizar status de pagamento do assinante
 */
export const updateSubscriberPaymentStatus = async (
  subscriberId: string,
  status: 'paid' | 'unpaid'
) => {
  try {
    console.log('💳 Atualizando status de pagamento:', { subscriberId, status });

    const updateData: any = {
      payment_status: status
    };

    if (status === 'paid') {
      updateData.last_payment_date = new Date().toISOString().split('T')[0];
    }

    const { data, error } = await supabase
      .from('client_subscriptions')
      .update(updateData)
      .eq('id', subscriberId)
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao atualizar status de pagamento:', error);
      throw error;
    }

    console.log('✅ Status de pagamento atualizado:', data);
    return { data, error: null };
  } catch (error) {
    console.error('❌ Erro ao atualizar status de pagamento:', error);
    return { data: null, error };
  }
};

/**
 * Remover assinante
 * Se houver histórico de atendimentos, arquiva em vez de apagar (preserva meses anteriores).
 */
export const getSubscriberDisplayName = (subscriber: any): string => {
  return (
    String(
      subscriber?.client_name_override ||
      subscriber?.subscriber_name ||
      subscriber?.profiles?.full_name ||
      subscriber?.name ||
      ''
    ).trim() || 'Cliente'
  );
};

export const getSubscriberPlanName = (subscriber: any): string => {
  return String(subscriber?.subscriptions?.name || subscriber?.subscription_name || 'Plano').trim() || 'Plano';
};

export const buildSubscriberAttendanceSnapshotFields = (subscriber: any) => ({
  client_name_snapshot: getSubscriberDisplayName(subscriber),
  subscription_name_snapshot: getSubscriberPlanName(subscriber),
});

export function isMissingSubscriberSnapshotColumnsError(error: unknown): boolean {
  const msg = String((error as any)?.message || '').toLowerCase();
  return (
    msg.includes('client_name_snapshot') ||
    msg.includes('subscription_name_snapshot') ||
    (msg.includes('schema cache') && msg.includes('subscriber_attendances'))
  );
}

export function isMissingSubscriberAppointmentIdColumnError(error: unknown): boolean {
  const msg = String((error as any)?.message || '').toLowerCase();
  return (
    msg.includes('appointment_id') &&
    (msg.includes('could not find') ||
      msg.includes('does not exist') ||
      msg.includes('schema cache') ||
      String((error as any)?.code || '') === '42703' ||
      String((error as any)?.code || '') === 'PGRST204')
  );
}

export function isMissingSubscriberProfessionalIdColumnError(error: unknown): boolean {
  const msg = String((error as any)?.message || '').toLowerCase();
  return (
    msg.includes('professional_id') &&
    (msg.includes('could not find') ||
      msg.includes('does not exist') ||
      msg.includes('schema cache') ||
      String((error as any)?.code || '') === '42703' ||
      String((error as any)?.code || '') === 'PGRST204')
  );
}

export function isMissingOptionalSubscriberAttendanceColumnError(error: unknown): boolean {
  return (
    isMissingSubscriberSnapshotColumnsError(error) ||
    isMissingSubscriberAppointmentIdColumnError(error) ||
    isMissingSubscriberProfessionalIdColumnError(error)
  );
}

export const normalizeProfessionalNameKey = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const PROFESSIONAL_UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type EstablishmentProfessionalRef = {
  id: string;
  name: string;
};

const isInvalidProfessionalName = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  return !normalized || normalized === 'unknown' || normalized === 'desconhecido';
};

/** Resolve profissional do agendamento priorizando ID (evita cair em nome duplicado/desatualizado). */
export function resolveAppointmentProfessionalForSubscriber(
  apt: {
    professional_id?: string | null;
    professional?: string | null;
    professional_name?: string | null;
  },
  professionals: EstablishmentProfessionalRef[]
): { professionalId: string | null; professionalName: string } {
  const idCandidates = [
    String(apt.professional_id || '').trim(),
    String(apt.professional || '').trim(),
  ].filter((value) => value && PROFESSIONAL_UUID_REGEX.test(value));

  for (const id of idCandidates) {
    const match = professionals.find((pro) => String(pro.id) === id);
    if (match?.name && !isInvalidProfessionalName(match.name)) {
      return { professionalId: id, professionalName: String(match.name).trim() };
    }
  }

  const rowName = String(apt.professional_name || '').trim();
  if (!isInvalidProfessionalName(rowName)) {
    const nameKey = normalizeProfessionalNameKey(rowName);
    const activeMatch = professionals.find(
      (pro) => normalizeProfessionalNameKey(pro.name) === nameKey
    );
    if (activeMatch?.id) {
      return {
        professionalId: String(activeMatch.id),
        professionalName: String(activeMatch.name).trim(),
      };
    }
    return { professionalId: idCandidates[0] || null, professionalName: rowName };
  }

  const legacyName = String(apt.professional || '').trim();
  if (legacyName && !PROFESSIONAL_UUID_REGEX.test(legacyName) && !isInvalidProfessionalName(legacyName)) {
    const nameKey = normalizeProfessionalNameKey(legacyName);
    const activeMatch = professionals.find(
      (pro) => normalizeProfessionalNameKey(pro.name) === nameKey
    );
    if (activeMatch?.id) {
      return {
        professionalId: String(activeMatch.id),
        professionalName: String(activeMatch.name).trim(),
      };
    }
    return { professionalId: null, professionalName: legacyName };
  }

  if (idCandidates[0]) {
    return { professionalId: idCandidates[0], professionalName: 'Profissional' };
  }

  return { professionalId: null, professionalName: 'Profissional' };
}

/** Agrupa atendimentos de assinatura por profissional ativo (ID primeiro, nome normalizado como fallback). */
export function resolveSubscriberAttendanceProfessionalGroup(
  attendance: { professional_id?: string | null; professional_name?: string | null },
  professionals: EstablishmentProfessionalRef[],
  deletedProfessionals: EstablishmentProfessionalRef[] = []
): { groupKey: string; displayName: string; professionalId: string | null } {
  const storedId = String(attendance.professional_id || '').trim();
  const storedName = String(attendance.professional_name || '').trim();

  const activeById = new Map<string, EstablishmentProfessionalRef>();
  professionals.forEach((pro) => {
    const id = String(pro.id || '').trim();
    if (id) activeById.set(id, pro);
  });

  const deletedById = new Map<string, EstablishmentProfessionalRef>();
  deletedProfessionals.forEach((pro) => {
    const id = String(pro.id || '').trim();
    if (id && !activeById.has(id)) deletedById.set(id, pro);
  });

  const activeIdSet = new Set(activeById.keys());

  const findActiveByNameKey = (nameKey: string): EstablishmentProfessionalRef | null => {
    if (!nameKey) return null;
    return (
      professionals.find((pro) => normalizeProfessionalNameKey(pro.name) === nameKey) || null
    );
  };

  const toActiveGroup = (active: EstablishmentProfessionalRef) => {
    const id = String(active.id || '').trim();
    const displayName = String(active.name || storedName || 'Profissional').trim() || 'Profissional';
    return {
      groupKey: `id:${id}`,
      displayName,
      professionalId: id,
    };
  };

  const redirectDeletedToActiveByName = (deletedRef?: EstablishmentProfessionalRef | null) => {
    const nameCandidates = [String(deletedRef?.name || '').trim(), storedName].filter(Boolean);
    for (const candidate of nameCandidates) {
      const nameKey = normalizeProfessionalNameKey(candidate);
      const activeMatch = findActiveByNameKey(nameKey);
      if (activeMatch?.id) return toActiveGroup(activeMatch);
    }
    return null;
  };

  if (storedId && activeById.has(storedId)) {
    return toActiveGroup(activeById.get(storedId)!);
  }

  // Backfill legado gravou UUID em professional_name — resolver pelo cadastro ativo.
  if (storedName && PROFESSIONAL_UUID_REGEX.test(storedName) && activeById.has(storedName)) {
    return toActiveGroup(activeById.get(storedName)!);
  }

  const storedNameKey = normalizeProfessionalNameKey(storedName);
  if (storedNameKey) {
    const activeByStoredName = findActiveByNameKey(storedNameKey);
    if (activeByStoredName) return toActiveGroup(activeByStoredName);
  }

  // Fallback: excluído com mesmo nome de um ativo → financeiro vai para o ativo.
  if (storedId && deletedById.has(storedId)) {
    const redirected = redirectDeletedToActiveByName(deletedById.get(storedId));
    if (redirected) return redirected;
  }

  if (storedName && PROFESSIONAL_UUID_REGEX.test(storedName) && deletedById.has(storedName)) {
    const redirected = redirectDeletedToActiveByName(deletedById.get(storedName));
    if (redirected) return redirected;
  }

  if (storedId && !activeIdSet.has(storedId)) {
    const redirected = redirectDeletedToActiveByName(null);
    if (redirected) return redirected;
  }

  if (storedId) {
    return {
      groupKey: `id:${storedId}`,
      displayName: storedName || 'Profissional',
      professionalId: storedId,
    };
  }

  if (storedNameKey) {
    return {
      groupKey: `name:${storedNameKey}`,
      displayName: storedName || 'Profissional',
      professionalId: null,
    };
  }

  return { groupKey: 'name:profissional', displayName: 'Profissional', professionalId: null };
}

export function subscriberAttendanceMatchesProfessionalGroup(
  attendance: { professional_id?: string | null; professional_name?: string | null },
  groupKey: string,
  professionals: EstablishmentProfessionalRef[],
  deletedProfessionals: EstablishmentProfessionalRef[] = []
): boolean {
  return resolveSubscriberAttendanceProfessionalGroup(attendance, professionals, deletedProfessionals).groupKey === groupKey;
}

const OPTIONAL_SUBSCRIBER_ATTENDANCE_COLUMNS = [
  'client_name_snapshot',
  'subscription_name_snapshot',
  'appointment_id',
  'professional_id',
] as const;

const buildInsertPayloadVariants = (payload: Record<string, unknown>): Record<string, unknown>[] => {
  const variants: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  const totalMasks = 1 << OPTIONAL_SUBSCRIBER_ATTENDANCE_COLUMNS.length;

  for (let mask = 0; mask < totalMasks; mask += 1) {
    const candidate = { ...payload };
    OPTIONAL_SUBSCRIBER_ATTENDANCE_COLUMNS.forEach((column, index) => {
      if (mask & (1 << index)) delete candidate[column];
    });
    const key = JSON.stringify(candidate);
    if (seen.has(key)) continue;
    seen.add(key);
    variants.push(candidate);
  }

  return variants.sort((a, b) => Object.keys(b).length - Object.keys(a).length);
};

/** Insert compatível: tenta com snapshot/appointment_id; se coluna ainda não existir no banco, grava só campos legados. */
export async function insertSubscriberAttendance(payload: Record<string, unknown>) {
  let lastError: any = null;
  for (const candidate of buildInsertPayloadVariants(payload)) {
    const { error } = await supabase.from('subscriber_attendances').insert(candidate as any);
    if (!error) return { error: null as any };
    lastError = error;
    if (!isMissingOptionalSubscriberAttendanceColumnError(error)) {
      return { error };
    }
  }
  return { error: lastError };
}

export async function findExistingSubscriberAttendance(params: {
  establishmentId: string;
  appointmentId?: string | null;
  clientSubscriptionId?: string | null;
  attendanceDate?: string | null;
  professionalId?: string | null;
  professionalName?: string | null;
}): Promise<string | null> {
  const establishmentId = String(params.establishmentId || '').trim();
  if (!establishmentId) return null;

  const appointmentId = String(params.appointmentId || '').trim();
  if (appointmentId) {
    try {
      const { data, error } = await supabase
        .from('subscriber_attendances')
        .select('id')
        .eq('establishment_id', establishmentId)
        .eq('appointment_id', appointmentId)
        .limit(1);
      if (!error && Array.isArray(data) && data[0]?.id) {
        return String(data[0].id);
      }
    } catch {
      // Coluna appointment_id pode não existir em bancos legados.
    }
  }

  const clientSubscriptionId = String(params.clientSubscriptionId || '').trim();
  const attendanceDate = String(params.attendanceDate || '').slice(0, 10);
  if (!clientSubscriptionId || !attendanceDate) return null;

  try {
    let query = supabase
      .from('subscriber_attendances')
      .select('id')
      .eq('establishment_id', establishmentId)
      .eq('client_subscription_id', clientSubscriptionId)
      .eq('attendance_date', attendanceDate);

    const professionalId = String(params.professionalId || '').trim();
    const professionalName = String(params.professionalName || '').trim();
    if (professionalId) {
      query = query.eq('professional_id', professionalId);
    } else if (professionalName) {
      query = query.eq('professional_name', professionalName);
    }

    const { data, error } = await query.limit(1);
    if (!error && Array.isArray(data) && data[0]?.id) {
      return String(data[0].id);
    }
  } catch {
    // segue
  }

  return null;
}

/** Evita duplicar atendimento (corrida de polling/backfill/conclusão). */
export async function insertSubscriberAttendanceOnce(
  payload: Record<string, unknown>
): Promise<{ error: any; inserted: boolean; existingId?: string | null }> {
  const existingId = await findExistingSubscriberAttendance({
    establishmentId: String(payload.establishment_id || ''),
    appointmentId: String(payload.appointment_id || ''),
    clientSubscriptionId: String(payload.client_subscription_id || ''),
    attendanceDate: String(payload.attendance_date || ''),
    professionalId: String(payload.professional_id || ''),
    professionalName: String(payload.professional_name || ''),
  });
  if (existingId) {
    return { error: null, inserted: false, existingId };
  }

  const { error } = await insertSubscriberAttendance(payload);
  return { error, inserted: !error, existingId: null };
}

/** Remove linhas duplicadas já gravadas (ex.: backfill repetido). Mantém o registro mais completo/antigo. */
export function dedupeSubscriberAttendanceRows<T extends Record<string, any>>(rows: T[]): T[] {
  const byKey = new Map<string, T>();

  const scoreRow = (row: T): number => {
    let score = 0;
    if (String(row?.appointment_id || '').trim()) score += 4;
    if (String(row?.professional_id || '').trim()) score += 2;
    if (Number(row?.repass_value || 0) > 0) score += 1;
    return score;
  };

  for (const row of rows || []) {
    const appointmentId = String(row?.appointment_id || '').trim();
    const key = appointmentId
      ? `apt:${appointmentId}`
      : [
        'day',
        String(row?.establishment_id || ''),
        String(row?.client_subscription_id || ''),
        String(row?.attendance_date || '').slice(0, 10),
        String(row?.professional_id || row?.professional_name || '').trim().toLowerCase(),
      ].join(':');

    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, row);
      continue;
    }

    const existingScore = scoreRow(existing);
    const rowScore = scoreRow(row);
    if (rowScore > existingScore) {
      byKey.set(key, row);
      continue;
    }
    if (rowScore < existingScore) continue;

    const existingTs = Date.parse(String(existing?.created_at || '')) || Number.MAX_SAFE_INTEGER;
    const rowTs = Date.parse(String(row?.created_at || '')) || Number.MAX_SAFE_INTEGER;
    if (rowTs < existingTs) byKey.set(key, row);
  }

  return Array.from(byKey.values());
}

const MANUAL_SUBSCRIBER_ATTENDANCE_PROFESSIONAL = 'Adicionado em Meus Assinantes';

const chunkArray = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

/** Só entra no financeiro: atendimento ligado a agendamento concluído de assinante, ou lançamento manual explícito. */
export async function filterSubscriberAttendancesForFinance(
  rows: any[],
  establishmentId: string
): Promise<any[]> {
  const deduped = dedupeSubscriberAttendanceRows(Array.isArray(rows) ? rows : []);
  const establishmentKey = String(establishmentId || '').trim();
  if (!establishmentKey || deduped.length === 0) return [];

  const linkedRows = deduped.filter((row) => String(row?.appointment_id || '').trim());
  const appointmentIds = Array.from(
    new Set(linkedRows.map((row) => String(row.appointment_id).trim()).filter(Boolean))
  );

  const validAppointmentIds = new Set<string>();

  let clientSubscriptionRows: any[] = [];
  try {
    const { data: subsData } = await supabase
      .from('client_subscriptions')
      .select(`
        id,
        subscription_id,
        payment_status,
        start_date,
        end_date,
        subscriber_name,
        subscriber_whatsapp,
        client_name_override,
        client_whatsapp
      `)
      .eq('establishment_id', establishmentKey);
    if (Array.isArray(subsData)) clientSubscriptionRows = subsData;
  } catch {
    // segue com fallback estrito se não carregar assinantes
  }

  for (const chunk of chunkArray(appointmentIds, 150)) {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('id, status, client_name, client_whatsapp, appointment_date, price, is_loyalty_reward, is_subscriber, payment_method, subscription_id, subscriber_service_id, subscriber_service_name')
        .eq('establishment_id', establishmentKey)
        .in('id', chunk)
        .eq('status', 'completed');
      if (error) throw error;
      (data || []).forEach((apt: any) => {
        if (isSubscriberAppointmentForProfessionalControl(apt, clientSubscriptionRows)) {
          validAppointmentIds.add(String(apt.id));
          return;
        }
        // Fallback: explicitamente marcado como assinante (is_subscriber=true ou payment_method='assinante')
        // mesmo que price > 0, o registro em subscriber_attendances é legítimo
        if (!parseSubscriberBoolean(apt?.is_loyalty_reward) &&
            (parseSubscriberBoolean(apt?.is_subscriber) ||
              String(apt?.payment_method || '').trim().toLowerCase() === 'assinante')) {
          validAppointmentIds.add(String(apt.id));
        }
      });
    } catch (error) {
      console.warn('Falha ao validar atendimentos de assinatura contra agendamentos:', error);
    }
  }

  return deduped.filter((row) => {
    const appointmentId = String(row?.appointment_id || '').trim();
    if (appointmentId) return validAppointmentIds.has(appointmentId);
    return String(row?.professional_name || '').trim() === MANUAL_SUBSCRIBER_ATTENDANCE_PROFESSIONAL;
  });
}

/** Completa o financeiro com agendamentos concluídos marcados como assinante na agenda (fallback). */
export async function mergeSubscriberAttendancesWithCompletedAppointments(params: {
  establishmentId: string;
  monthStart: string;
  monthEnd: string;
  existingRows: any[];
  professionals?: EstablishmentProfessionalRef[];
}): Promise<any[]> {
  const establishmentId = String(params.establishmentId || '').trim();
  const monthStart = String(params.monthStart || '').slice(0, 10);
  const monthEnd = String(params.monthEnd || '').slice(0, 10);
  if (!establishmentId || !monthStart || !monthEnd) {
    return dedupeSubscriberAttendanceRows(params.existingRows || []);
  }

  const existing = dedupeSubscriberAttendanceRows(params.existingRows || []);
  const coveredAppointmentIds = new Set(
    existing.map((row) => String(row?.appointment_id || '').trim()).filter(Boolean)
  );

  const { data: appointments, error: appointmentsError } = await supabase
    .from('appointments')
    .select(`
      id,
      client_name,
      client_whatsapp,
      appointment_date,
      appointment_time,
      status,
      professional,
      price,
      is_subscriber,
      payment_method,
      subscription_id,
      subscriber_service_id,
      subscriber_service_name,
      service,
      is_loyalty_reward
    `)
    .eq('establishment_id', establishmentId)
    .eq('status', 'completed')
    .gte('appointment_date', monthStart)
    .lte('appointment_date', monthEnd);

  if (appointmentsError || !Array.isArray(appointments) || appointments.length === 0) {
    return existing;
  }

  let clientSubscriptionRows: any[] = [];
  try {
    const { data, error } = await supabase
      .from('client_subscriptions')
      .select(`
        id,
        subscription_id,
        monthly_limit,
        payment_status,
        start_date,
        end_date,
        subscriber_name,
        subscriber_whatsapp,
        client_name_override,
        client_whatsapp,
        subscriptions (
          id,
          name,
          value,
          fixed_commission_value,
          divide_total_enabled,
          divide_total_attendances,
          divided_services
        )
      `)
      .eq('establishment_id', establishmentId);
    if (!error && Array.isArray(data)) clientSubscriptionRows = data;
  } catch {
    // segue sem match de plano
  }

  const subscriptionsByPhone = buildSubscriptionsByPhoneMap(clientSubscriptionRows as any[]);
  const subscriptionsByName = buildSubscriptionsByNameMap(clientSubscriptionRows as any[]);
  const professionals = params.professionals || [];
  const validAppointmentIds = new Set<string>();
  const synthetic: any[] = [];

  // Mapa de fallback: nome snapshot dos rows existentes → client_subscription_id
  // Usado quando o nome no agendamento é parcial (ex: "Jhon Cristophe" vs "Jhon Cristophe de Paiva Silva")
  const existingSubIdByNameKey = new Map<string, string>();
  existing.forEach((row: any) => {
    const subId = String(row?.client_subscription_id || '').trim();
    const nameKey = normalizeSubscriberNameKey(String(row?.client_name_snapshot || ''));
    if (subId && nameKey) existingSubIdByNameKey.set(nameKey, subId);
  });

  for (const apt of appointments) {
    const appointmentId = String(apt?.id || '').trim();
    if (!appointmentId) continue;
    const isStandardSubscriber = isSubscriberAppointmentForProfessionalControl(apt as any, clientSubscriptionRows);
    const isExplicitSubscriber = !isStandardSubscriber &&
      !parseSubscriberBoolean((apt as any)?.is_loyalty_reward) &&
      (parseSubscriberBoolean((apt as any)?.is_subscriber) ||
        String((apt as any)?.payment_method || '').trim().toLowerCase() === 'assinante');
    // Terceiro caso: price=0, sem method avulso e sem flags — confirma via match em client_subscriptions
    const aptPaymentMethod = String((apt as any)?.payment_method || '').trim().toLowerCase();
    const isZeroPriceCandidate = !isStandardSubscriber && !isExplicitSubscriber &&
      !parseSubscriberBoolean((apt as any)?.is_loyalty_reward) &&
      Number((apt as any)?.price ?? 0) === 0 &&
      !EXPLICIT_AVULSO_PAYMENT_METHODS.has(aptPaymentMethod);
    if (!isStandardSubscriber && !isExplicitSubscriber && !isZeroPriceCandidate) continue;

    validAppointmentIds.add(appointmentId);

    if (coveredAppointmentIds.has(appointmentId)) continue;

    let matched = findMatchingSubscriptionForAppointment(
      apt as any,
      subscriptionsByPhone,
      subscriptionsByName
    );
    // Fallback relaxado: assinante unpaid com flags explícitas OU price=0 sem method avulso.
    if (!matched && (isExplicitSubscriber || isZeroPriceCandidate)) {
      matched = findMatchingSubscriptionRelaxed(apt as any, subscriptionsByPhone, subscriptionsByName);
    }
    // Fallback por nome dos rows existentes: cobre casos onde o nome no agendamento é parcial
    // (ex: "Jhon Cristophe" no agendamento vs "Jhon Cristophe de Paiva Silva" no cadastro).
    if (!matched && (isExplicitSubscriber || isZeroPriceCandidate) && existingSubIdByNameKey.size > 0) {
      const aptNameKey = normalizeSubscriberNameKey((apt as any)?.client_name);
      let resolvedSubId: string | null = null;
      if (aptNameKey) resolvedSubId = existingSubIdByNameKey.get(aptNameKey) || null;
      if (!resolvedSubId && aptNameKey && aptNameKey.length >= 6) {
        for (const [key, subId] of existingSubIdByNameKey) {
          if (key.includes(aptNameKey) || aptNameKey.includes(key)) {
            resolvedSubId = subId;
            break;
          }
        }
      }
      if (resolvedSubId) {
        matched = (clientSubscriptionRows as any[]).find((row: any) => String(row?.id || '') === resolvedSubId) || null;
      }
    }
    const matchedSubscriptionId = String(matched?.id || '').trim();
    // Só entra no financeiro se existir cadastro em Meus Assinantes.
    if (!matchedSubscriptionId) {
      continue;
    }

    // Exige ao menos um indicador explícito de assinante no agendamento.
    // Impede que agendamentos avulsos com preço zerado manualmente (ex: R$45 → R$0)
    // sejam contados como visitas de assinatura só por terem price=0 + match de cadastro.
    const aptHasExplicitSubscriberFlag =
      parseSubscriberBoolean((apt as any)?.is_subscriber) ||
      String((apt as any)?.payment_method || '').trim().toLowerCase() === 'assinante' ||
      String((apt as any)?.subscriber_service_id || '').trim() !== '' ||
      String((apt as any)?.subscriber_service_name || '').trim() !== '' ||
      String((apt as any)?.subscription_id || '').trim() !== '' ||
      /\(\s*assinante\s*\)/i.test(String((apt as any)?.client_name || ''));
    if (!aptHasExplicitSubscriberFlag) {
      continue;
    }

    const professionalRecord = resolveAppointmentProfessionalForSubscriber(apt as any, professionals);
    const subscription = (matched as any)?.subscriptions || null;
    const repassValue = computeSubscriberRepassValue({
      subscription,
      monthlyLimit: Number((matched as any)?.monthly_limit || 0),
      appointmentPrice: Number((apt as any)?.price || 0),
    });

    synthetic.push({
      id: `apt:${appointmentId}`,
      appointment_id: appointmentId,
      establishment_id: establishmentId,
      client_subscription_id: matchedSubscriptionId,
      professional_id: professionalRecord.professionalId,
      professional_name: professionalRecord.professionalName,
      attendance_date: String((apt as any)?.appointment_date || '').slice(0, 10),
      repass_value: repassValue,
      client_name_snapshot: String((apt as any)?.client_name || '').trim() || 'Cliente',
      subscription_name_snapshot:
        String((apt as any)?.service || (apt as any)?.subscriber_service_name || 'Atendimento assinatura').trim() ||
        'Atendimento assinatura',
      __synthetic_from_appointment: true,
    });
    coveredAppointmentIds.add(appointmentId);
  }

  const filteredExisting = existing.filter((row) => {
    const aptId = String(row?.appointment_id || '').trim();
    if (!aptId) {
      return String(row?.professional_name || '').trim() === MANUAL_SUBSCRIBER_ATTENDANCE_PROFESSIONAL;
    }
    if (validAppointmentIds.size === 0) return false;
    return validAppointmentIds.has(aptId);
  });

  return dedupeSubscriberAttendanceRows([...filteredExisting, ...synthetic]);
}

export type RemoveSubscriberAttendanceForAppointmentParams = {
  establishmentId: string;
  appointmentId: string;
  appointmentDate?: string;
  clientSubscriptionId?: string;
  professionalName?: string;
  clientWhatsapp?: string;
};

const resolveClientSubscriptionIdByPhone = async (
  establishmentId: string,
  clientWhatsapp: string
): Promise<string | null> => {
  const phone = normalizeSubscriberWhatsapp(clientWhatsapp);
  if (!phone) return null;
  const { data } = await findExistingSubscriberByPhone(establishmentId, phone);
  return data?.id ? String(data.id) : null;
};

/** Remove o atendimento de assinatura vinculado a um agendamento cancelado após conclusão. */
export async function removeSubscriberAttendanceForCancelledAppointment(
  params: RemoveSubscriberAttendanceForAppointmentParams
): Promise<{ removedCount: number; error: any }> {
  const establishmentId = String(params.establishmentId || '').trim();
  const appointmentId = String(params.appointmentId || '').trim();
  if (!establishmentId || !appointmentId) {
    return { removedCount: 0, error: null };
  }

  const deleteByIds = async (ids: string[]) => {
    if (!ids.length) return { removedCount: 0, error: null };
    const { error } = await supabase.from('subscriber_attendances').delete().in('id', ids);
    return { removedCount: error ? 0 : ids.length, error };
  };

  try {
    const { data: byAppointmentRows, error: byAppointmentError } = await supabase
      .from('subscriber_attendances')
      .select('id')
      .eq('establishment_id', establishmentId)
      .eq('appointment_id', appointmentId);

    if (!byAppointmentError && Array.isArray(byAppointmentRows) && byAppointmentRows.length > 0) {
      return deleteByIds(byAppointmentRows.map((row: any) => String(row.id)).filter(Boolean));
    }

    if (
      byAppointmentError &&
      !isMissingSubscriberAppointmentIdColumnError(byAppointmentError)
    ) {
      return { removedCount: 0, error: byAppointmentError };
    }
  } catch (error) {
    console.warn('Falha ao buscar atendimento de assinatura por appointment_id:', error);
  }

  let clientSubscriptionId = String(params.clientSubscriptionId || '').trim();
  let attendanceDate = String(params.appointmentDate || '').trim().slice(0, 10);
  const professionalName = String(params.professionalName || '').trim();

  try {
    const { data: logs, error: logsError } = await supabase
      .from('appointment_change_logs')
      .select('metadata')
      .eq('establishment_id', establishmentId)
      .eq('appointment_id', appointmentId)
      .eq('event_type', 'subscriber_attendance_marked')
      .order('created_at', { ascending: false })
      .limit(1);

    if (!logsError && Array.isArray(logs) && logs.length > 0) {
      const metadata = (logs[0] as any)?.metadata || {};
      clientSubscriptionId =
        clientSubscriptionId || String(metadata?.subscriber_id || metadata?.client_subscription_id || '').trim();
      attendanceDate =
        attendanceDate || String(metadata?.attendance_date || '').trim().slice(0, 10);
    }
  } catch {
    // Histórico opcional.
  }

  if (!clientSubscriptionId && params.clientWhatsapp) {
    clientSubscriptionId = (await resolveClientSubscriptionIdByPhone(establishmentId, params.clientWhatsapp)) || '';
  }

  if (!clientSubscriptionId || !attendanceDate) {
    return { removedCount: 0, error: null };
  }

  const { data: candidateRows, error: candidateError } = await supabase
    .from('subscriber_attendances')
    .select('id, professional_name, created_at')
    .eq('establishment_id', establishmentId)
    .eq('client_subscription_id', clientSubscriptionId)
    .eq('attendance_date', attendanceDate)
    .order('created_at', { ascending: false });

  if (candidateError) {
    return { removedCount: 0, error: candidateError };
  }

  const rows = Array.isArray(candidateRows) ? candidateRows : [];
  if (rows.length === 0) {
    return { removedCount: 0, error: null };
  }

  let targets = rows;
  if (professionalName) {
    const professionalKey = normalizeProfessionalNameKey(professionalName);
    const filtered = rows.filter(
      (row: any) => normalizeProfessionalNameKey(row?.professional_name) === professionalKey
    );
    if (filtered.length > 0) {
      targets = filtered;
    }
  }

  return deleteByIds([String((targets[0] as any)?.id || '').trim()].filter(Boolean));
}

export const isArchivedSubscriber = (subscriber: any): boolean =>
  Boolean(String(subscriber?.archived_at || '').trim());

export const isDeactivatedSubscriber = (subscriber: any): boolean =>
  Boolean(String(subscriber?.deactivated_at || '').trim());

export const deactivateSubscriber = async (subscriberId: string) => {
  try {
    const todayIso = new Date().toISOString().split('T')[0];
    const { data: existing, error: fetchError } = await supabase
      .from('client_subscriptions')
      .select('id, end_date')
      .eq('id', subscriberId)
      .maybeSingle();

    if (fetchError) throw fetchError;

    const currentEndDate = String((existing as any)?.end_date || '').trim().slice(0, 10);
    const payload: Record<string, unknown> = {
      deactivated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (!currentEndDate || currentEndDate > todayIso) {
      payload.end_date = todayIso;
    }

    let { error } = await supabase.from('client_subscriptions').update(payload).eq('id', subscriberId);

    if (error) {
      const msg = String(error.message || '').toLowerCase();
      if (msg.includes('deactivated_at')) {
        const { deactivated_at, ...legacyPayload } = payload;
        ({ error } = await supabase.from('client_subscriptions').update(legacyPayload).eq('id', subscriberId));
      }
      if (error) throw error;
    }

    return { data: { deactivated: true }, error: null };
  } catch (error) {
    console.error('❌ Erro ao desativar assinante:', error);
    return { data: null, error };
  }
};

export const reactivateSubscriber = async (subscriberId: string) => {
  try {
    let { error } = await supabase
      .from('client_subscriptions')
      .update({
        deactivated_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscriberId);

    if (error) {
      const msg = String(error.message || '').toLowerCase();
      if (msg.includes('deactivated_at')) {
        ({ error } = await supabase
          .from('client_subscriptions')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', subscriberId));
      }
      if (error) throw error;
    }

    return { data: { reactivated: true }, error: null };
  } catch (error) {
    console.error('❌ Erro ao reativar assinante:', error);
    return { data: null, error };
  }
};

export const removeSubscriber = async (subscriberId: string) => {
  try {
    console.log('🗑️ Removendo/arquivando assinante:', subscriberId);

    const { count, error: countError } = await supabase
      .from('subscriber_attendances')
      .select('id', { count: 'exact', head: true })
      .eq('client_subscription_id', subscriberId);

    if (countError) {
      console.warn('⚠️ Não foi possível verificar histórico de atendimentos:', countError.message);
    }

    const hasAttendanceHistory = Number(count || 0) > 0;
    const todayIso = new Date().toISOString().split('T')[0];

    if (hasAttendanceHistory) {
      const { data: existing, error: fetchError } = await supabase
        .from('client_subscriptions')
        .select('id, end_date, subscriber_name, subscriptions(name)')
        .eq('id', subscriberId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      const currentEndDate = String((existing as any)?.end_date || '').trim().slice(0, 10);
      const archivePayload: Record<string, unknown> = {
        archived_at: new Date().toISOString(),
        deactivated_at: null,
        updated_at: new Date().toISOString(),
      };

      if (!currentEndDate || currentEndDate > todayIso) {
        archivePayload.end_date = todayIso;
      }

      const { error: archiveError } = await supabase
        .from('client_subscriptions')
        .update(archivePayload)
        .eq('id', subscriberId);

      if (archiveError) {
        const msg = String(archiveError.message || '').toLowerCase();
        if (msg.includes('deactivated_at') && !msg.includes('archived_at')) {
          const { deactivated_at, ...withoutDeactivated } = archivePayload;
          const { error: retryError } = await supabase
            .from('client_subscriptions')
            .update(withoutDeactivated)
            .eq('id', subscriberId);
          if (retryError) throw retryError;
        } else if (msg.includes('archived_at')) {
          const { end_date, updated_at } = archivePayload;
          const { error: legacyArchiveError } = await supabase
            .from('client_subscriptions')
            .update({ end_date, updated_at })
            .eq('id', subscriberId);
          if (legacyArchiveError) throw legacyArchiveError;
        } else {
          throw archiveError;
        }
      }

      console.log('✅ Assinante arquivado (histórico preservado)');
      return { data: { archived: true }, error: null };
    }

    const { error } = await supabase.from('client_subscriptions').delete().eq('id', subscriberId);

    if (error) {
      console.error('❌ Erro ao remover assinante:', error);
      throw error;
    }

    console.log('✅ Assinante removido com sucesso');
    return { data: { archived: false }, error: null };
  } catch (error) {
    console.error('❌ Erro ao remover assinante:', error);
    return { data: null, error };
  }
};

export async function findClientSubscriptionForAppointment(params: {
  establishmentId: string;
  clientWhatsapp?: string | null;
  clientName?: string | null;
  appointmentDate?: string | null;
}) {
  const establishmentId = String(params.establishmentId || '').trim();
  if (!establishmentId) return null;

  const { data, error } = await supabase
    .from('client_subscriptions')
    .select(`
      id,
      subscription_id,
      monthly_limit,
      payment_status,
      start_date,
      end_date,
      updated_at,
      created_at,
      subscriber_name,
      subscriber_whatsapp,
      client_name_override,
      client_whatsapp,
      subscriptions (
        id,
        name,
        value,
        fixed_commission_value,
        divide_total_enabled,
        divide_total_attendances,
        divided_services
      )
    `)
    .eq('establishment_id', establishmentId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const rows = Array.isArray(data) ? data : [];
  const subscriptionsByPhone = buildSubscriptionsByPhoneMap(rows as any[]);
  const subscriptionsByName = buildSubscriptionsByNameMap(rows as any[]);

  return findMatchingSubscriptionForAppointment(
    {
      client_whatsapp: params.clientWhatsapp,
      client_name: params.clientName,
      appointment_date: params.appointmentDate,
    },
    subscriptionsByPhone,
    subscriptionsByName
  );
}

export async function persistSubscriberAppointmentFlagsIfNeeded(
  appointmentId: string,
  fields: {
    is_subscriber?: boolean;
    payment_method?: string | null;
    subscription_id?: string | null;
    subscriber_service_id?: string | null;
    subscriber_service_name?: string | null;
  }
): Promise<{ updated: boolean; error: any }> {
  const id = String(appointmentId || '').trim();
  if (!id || !fields.is_subscriber) return { updated: false, error: null };

  const payload: Record<string, unknown> = {
    is_subscriber: true,
    payment_method: fields.payment_method || 'assinante',
  };
  if (fields.subscription_id) payload.subscription_id = fields.subscription_id;
  if (fields.subscriber_service_id) payload.subscriber_service_id = fields.subscriber_service_id;
  if (fields.subscriber_service_name) payload.subscriber_service_name = fields.subscriber_service_name;

  let { error } = await supabase.from('appointments').update(payload as any).eq('id', id);

  if (error) {
    const msg = String(error.message || '').toLowerCase();
    if (msg.includes('subscription_id') || msg.includes('subscriber_service_')) {
      const fallback = { is_subscriber: true, payment_method: 'assinante' };
      ({ error } = await supabase.from('appointments').update(fallback as any).eq('id', id));
    }
  }

  return { updated: !error, error };
}

const resolveMaxLimitFromDividedServices = (subscription: any): number => {
  try {
    const raw = subscription?.divided_services;
    const arr = Array.isArray(raw) ? raw : typeof raw === 'string' ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return 0;
    const limits = arr
      .map((s: any) => Math.floor(Number(s?.limit || 0)))
      .filter((n: number) => Number.isFinite(n) && n > 0);
    return limits.length > 0 ? Math.max(...limits) : 0;
  } catch {
    return 0;
  }
};

/** Repasse financeiro por atendimento (mensalidade ÷ limite, ou repasse fixo por visita). */
export const computeSubscriberRepassValue = (params: {
  subscription: any;
  monthlyLimit: number;
  appointmentPrice: number;
}): number => {
  const subscription = params.subscription || {};
  const divideEnabledExplicit = parseSubscriberBoolean(subscription?.divide_total_enabled);
  const fixedCommission = Number(subscription?.fixed_commission_value || 0);
  const subscriptionValue = Number(subscription?.value || 0);
  const fallbackFromAppointmentPrice = Number(params.appointmentPrice || 0);
  const monthlyLimit = Math.floor(Number(params.monthlyLimit || 0)) || 0;
  const limitFromServices = resolveMaxLimitFromDividedServices(subscription);

  const pointsModeSubscription = !divideEnabledExplicit && !(fixedCommission > 0);
  if (pointsModeSubscription) return 0;

  let baseFixed = 0;
  if (Number.isFinite(fixedCommission) && fixedCommission > 0) {
    baseFixed = fixedCommission;
  } else if (divideEnabledExplicit) {
    baseFixed =
      Number.isFinite(subscriptionValue) && subscriptionValue > 0
        ? subscriptionValue
        : Number.isFinite(fallbackFromAppointmentPrice) && fallbackFromAppointmentPrice > 0
          ? fallbackFromAppointmentPrice
          : 0;
  }

  const divideFromSubscription = Math.floor(Number(subscription?.divide_total_attendances || 0)) || 0;
  let divideCount =
    divideFromSubscription > 0
      ? divideFromSubscription
      : monthlyLimit > 0
        ? monthlyLimit
        : limitFromServices > 0
          ? limitFromServices
          : 0;

  const round2 = (v: number) => Math.round(v * 100) / 100;
  const fullMonthlyRepass = subscriptionValue > 0 && baseFixed >= subscriptionValue * 0.95;

  // Plano mensal (ex.: R$80 com "2 no mês") sem "Dividir valor total" no plano:
  // reparte o repasse total pelo limite do cliente/serviço.
  let effectiveDivide = divideEnabledExplicit;
  if (!effectiveDivide && fullMonthlyRepass && divideCount > 1) {
    effectiveDivide = true;
  }

  // Config incompleta: divide ligado com qtd=1 mas cliente/serviço permite mais.
  if (effectiveDivide && fullMonthlyRepass) {
    if (monthlyLimit > divideCount && divideFromSubscription <= 1) {
      divideCount = monthlyLimit;
    } else if (divideCount <= 1 && limitFromServices > 1) {
      divideCount = limitFromServices;
    }
  }

  if (effectiveDivide && divideCount <= 0) return 0;

  let repassValue = round2(baseFixed);
  if (effectiveDivide && divideCount > 0) {
    repassValue = round2(repassValue / divideCount);
  }
  return repassValue;
};

/** Repara atendimentos faltantes — DESATIVADO: gerava registros fantasma no financeiro. Use auto-registro ao concluir na agenda. */
export async function backfillMissingSubscriberAttendancesForAppointments(_params: {
  establishmentId: string;
  appointments: Array<Record<string, unknown>>;
  professionals?: EstablishmentProfessionalRef[];
  limit?: number;
}): Promise<{ inserted: number }> {
  return { inserted: 0 };
}
