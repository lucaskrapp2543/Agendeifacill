import { createClient } from '@supabase/supabase-js';
import { WhatsAppMessageQueue } from './messageQueue';
import { WhatsAppReminderScheduler } from './reminderScheduler';
import type { SendMessageResult, SessionStatusPayload } from './types';
import { WhatsAppManager } from './whatsappManager';

let supabaseAdminCache: any = null;
const getSupabaseAdmin = () => {
  if (supabaseAdminCache) return supabaseAdminCache;
  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!supabaseUrl || !serviceRoleKey) return null;
  supabaseAdminCache = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return supabaseAdminCache;
};

const persistSessionStatus = async (payload: SessionStatusPayload) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return;
  const userId = String(payload.userId || '').trim();
  if (!userId) return;

  const { data: existingSession } = await supabaseAdmin
    .from('whatsapp_sessions')
    .select('phone,connected_at')
    .eq('user_id', userId)
    .maybeSingle();

  const isConnectedStatus = String(payload.status || '').toLowerCase() === 'connected';
  const phoneToPersist = isConnectedStatus
    ? payload.phone || null
    : payload.phone || existingSession?.phone || null;
  const connectedAtToPersist = isConnectedStatus
    ? payload.connectedAt || new Date().toISOString()
    : payload.connectedAt || existingSession?.connected_at || null;

  await supabaseAdmin.from('whatsapp_sessions').upsert(
    {
      user_id: userId,
      status: payload.status,
      phone: phoneToPersist,
      session_path: payload.sessionPath,
      connected_at: connectedAtToPersist,
      last_seen: payload.lastSeen || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
};

const resolveLogStatus = (result: SendMessageResult): 'queued' | 'sent' | 'accepted' | 'failed' => {
  if (!result?.ok) return 'failed';
  if (result.ackConfirmed === false) return 'accepted';
  return String(result.deliveryMode || '').toLowerCase() === 'queued' ? 'queued' : 'sent';
};

const isScheduleSensitiveMessageType = (messageTypeRaw: string): boolean => {
  const messageType = String(messageTypeRaw || '').trim().toLowerCase();
  if (!messageType) return false;
  if (messageType === 'booking_confirmation') return true;
  return /^reminder_\d+m$/.test(messageType);
};

const isInternalEstablishmentAppointment = (
  appointment: {
    client_id?: string | null;
    establishment_id?: string | null;
    is_establishment_booking?: boolean | null;
    is_avulso?: boolean | null;
    is_squeeze?: boolean | null;
  },
  ownerId: string
): boolean => {
  if (Boolean(appointment.is_establishment_booking)) return true;
  if (Boolean(appointment.is_avulso)) return true;
  if (Boolean(appointment.is_squeeze)) return true;
  const normalizedOwnerId = String(ownerId || '').trim();
  const clientId = String(appointment.client_id || '').trim();
  if (normalizedOwnerId && clientId && clientId === normalizedOwnerId) return true;
  return false;
};

const shouldSkipAutomationSend = async (
  log: { appointmentId: string; messageType: string } | undefined
): Promise<string | null> => {
  if (!log?.appointmentId || !log?.messageType) return null;
  if (!isScheduleSensitiveMessageType(log.messageType)) return null;
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return null;

  const appointmentId = String(log.appointmentId || '').trim();
  if (!appointmentId) return null;

  const messageType = String(log.messageType || '').trim().toLowerCase();
  const selectAttempts = [
    'status,establishment_id,client_id,is_establishment_booking,is_avulso,is_squeeze',
    'status,establishment_id,client_id,is_establishment_booking',
    'status,establishment_id,client_id',
    'status',
  ];

  let appointment: any = null;
  for (const selectClause of selectAttempts) {
    const { data, error } = await supabaseAdmin
      .from('appointments')
      .select(selectClause)
      .eq('id', appointmentId)
      .maybeSingle();
    if (!error && data) {
      appointment = data;
      break;
    }
    const msg = String(error?.message || '').toLowerCase();
    const missingColumn = String(error?.code || '').trim().toUpperCase() === '42703' || msg.includes('does not exist');
    if (!missingColumn) {
      console.warn('[whatsapp/queue] Falha ao validar agendamento antes de enviar automação:', {
        appointmentId,
        messageType: log.messageType,
        error: String(error?.message || error),
      });
      break;
    }
  }

  if (!appointment) return null;

  const status = String(appointment?.status || '').trim().toLowerCase();
  if (status === 'cancelled') {
    return `Envio automático ignorado: agendamento ${appointmentId} já está cancelado.`;
  }

  if (messageType === 'booking_confirmation') {
    const establishmentId = String(appointment.establishment_id || '').trim();
    if (establishmentId) {
      const { data: establishmentData } = await supabaseAdmin
        .from('establishments')
        .select('owner_id')
        .eq('id', establishmentId)
        .maybeSingle();
      const ownerId = String((establishmentData as any)?.owner_id || '').trim();
      if (isInternalEstablishmentAppointment(appointment, ownerId)) {
        return `Envio automático ignorado: agendamento ${appointmentId} foi criado dentro da barbearia (sem saudação).`;
      }
    }
  }

  return null;
};

const persistAutomationMessageResult = async (
  log: { appointmentId: string; messageType: string } | undefined,
  result: SendMessageResult
) => {
  if (!log?.appointmentId || !log?.messageType) return;
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return;
  const status = resolveLogStatus(result);
  const { error } = await supabaseAdmin
    .from('whatsapp_message_logs')
    .update({
      status,
      error: result.error || null,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
    })
    .eq('provider', 'baileys')
    .eq('appointment_id', log.appointmentId)
    .eq('message_type', log.messageType);
  if (error) {
    console.warn('[whatsapp/queue] Falha ao atualizar log de automação:', {
      appointmentId: log.appointmentId,
      messageType: log.messageType,
      status,
      error: String(error?.message || error),
    });
  }
};

const manager = new WhatsAppManager({
  onStatusChange: persistSessionStatus,
});

const queue = new WhatsAppMessageQueue(async (job) => {
  const skipReason = await shouldSkipAutomationSend(job.automationLog);
  if (skipReason) {
    const skippedResult: SendMessageResult = {
      ok: false,
      provider: 'baileys',
      deliveryMode: 'direct',
      error: skipReason,
    };
    await persistAutomationMessageResult(job.automationLog, skippedResult);
    return skippedResult;
  }

  const result = await manager.sendMessage(job);
  await persistAutomationMessageResult(job.automationLog, result);
  return result;
});
let scheduler: WhatsAppReminderScheduler | null = null;
let initialized = false;

const parseBoolEnv = (key: string, fallback: boolean): boolean => {
  const raw = String(process.env[key] || '').trim().toLowerCase();
  if (!raw) return fallback;
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
};

export const initializeWhatsAppServices = () => {
  if (initialized) return;
  initialized = true;

  const runtimeRoleRaw = String(process.env.WHATSAPP_RUNTIME_ROLE || 'all').trim().toLowerCase();
  const runtimeRole = runtimeRoleRaw === 'api' || runtimeRoleRaw === 'worker' ? runtimeRoleRaw : 'all';
  const queueModeOverride = String(process.env.WHATSAPP_QUEUE_MODE || '').trim().toLowerCase();
  const queueMode =
    queueModeOverride === 'producer' ||
    queueModeOverride === 'consumer' ||
    queueModeOverride === 'direct' ||
    queueModeOverride === 'all'
      ? queueModeOverride
      : runtimeRole === 'api'
        ? 'producer'
        : runtimeRole === 'worker'
          ? 'consumer'
          : 'all';
  queue.initialize(queueMode as 'all' | 'producer' | 'consumer' | 'direct');

  const nodeEnv = String(process.env.NODE_ENV || '').trim().toLowerCase();
  const isDevelopmentRuntime = !nodeEnv || nodeEnv === 'development';
  const defaultSchedulerEnabled = runtimeRole !== 'api' && !isDevelopmentRuntime;
  const schedulerEnabled = parseBoolEnv('WHATSAPP_ENABLE_SCHEDULER', defaultSchedulerEnabled);
  if (schedulerEnabled) {
    scheduler = new WhatsAppReminderScheduler({
      enqueueOrSend: (payload) => queue.enqueueOrSend(payload),
    });
    scheduler.start();
  } else {
    console.log('ℹ️ Scheduler de WhatsApp desativado neste processo.');
  }

  const sessionsDir = String(process.env.WHATSAPP_SESSIONS_DIR || '').trim() || 'sessions (default local)';
  console.log(`📁 WhatsApp sessions dir: ${sessionsDir}`);
  const workerId = Number(process.env.WHATSAPP_WORKER_ID || 0) || 0;
  const workerCount = Number(process.env.WHATSAPP_WORKER_COUNT || 1) || 1;
  console.log(`🧩 WhatsApp runtime role: ${runtimeRole}`);
  console.log(`📮 WhatsApp queue mode: ${queueMode}`);
  console.log(`⏱️ WhatsApp scheduler: ${schedulerEnabled ? 'enabled' : 'disabled'}`);
  console.log(`📦 WhatsApp scale profile: worker ${workerId + 1}/${Math.max(1, workerCount)}`);

  // Após deploy/restart, religa sessões salvas no disco persistente (Render /var/data).
  manager.startSessionMaintenance();
};

export const getWhatsAppManager = () => manager;

export const sendWhatsAppMessage = async (userId: string, phone: string, message: string) => {
  return queue.enqueueOrSend({ userId, phone, message });
};
