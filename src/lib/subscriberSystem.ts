/**
 * Sistema independente de assinantes
 * Não depende da lista de clientes existentes
 */

import { v4 as uuidv4 } from 'uuid';
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
        errMsg.includes('subscriber_professional_name')
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
        subscriptions (name, value, duration_months)
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

/** Agrupa atendimentos de assinatura por profissional (ID primeiro, nome normalizado como fallback). */
export function resolveSubscriberAttendanceProfessionalGroup(
  attendance: { professional_id?: string | null; professional_name?: string | null },
  professionals: EstablishmentProfessionalRef[],
  deletedProfessionals: EstablishmentProfessionalRef[] = []
): { groupKey: string; displayName: string; professionalId: string | null } {
  const storedId = String(attendance.professional_id || '').trim();
  const storedName = String(attendance.professional_name || '').trim();
  const allById = new Map<string, EstablishmentProfessionalRef>();

  [...professionals, ...deletedProfessionals].forEach((pro) => {
    const id = String(pro.id || '').trim();
    if (id) allById.set(id, pro);
  });

  if (storedId && allById.has(storedId)) {
    const pro = allById.get(storedId)!;
    return {
      groupKey: `id:${storedId}`,
      displayName: String(pro.name || storedName || 'Profissional').trim() || 'Profissional',
      professionalId: storedId,
    };
  }

  const nameKey = normalizeProfessionalNameKey(storedName);
  if (nameKey) {
    const activeMatch = professionals.find(
      (pro) => normalizeProfessionalNameKey(pro.name) === nameKey
    );
    if (activeMatch?.id) {
      return {
        groupKey: `id:${String(activeMatch.id)}`,
        displayName: String(activeMatch.name).trim() || storedName,
        professionalId: String(activeMatch.id),
      };
    }
  }

  if (storedId) {
    return {
      groupKey: `id:${storedId}`,
      displayName: storedName || 'Profissional',
      professionalId: storedId,
    };
  }

  if (nameKey) {
    return {
      groupKey: `name:${nameKey}`,
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
