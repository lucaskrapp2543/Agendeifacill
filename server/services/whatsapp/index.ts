import { createClient } from '@supabase/supabase-js';
import { WhatsAppMessageQueue } from './messageQueue';
import { WhatsAppReminderScheduler } from './reminderScheduler';
import type { SessionStatusPayload } from './types';
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
  await supabaseAdmin.from('whatsapp_sessions').upsert(
    {
      user_id: userId,
      status: payload.status,
      phone: payload.phone || null,
      session_path: payload.sessionPath,
      connected_at: payload.connectedAt || null,
      last_seen: payload.lastSeen || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
};

const manager = new WhatsAppManager({
  onStatusChange: persistSessionStatus,
});

const queue = new WhatsAppMessageQueue((job) => manager.sendMessage(job));
let scheduler: WhatsAppReminderScheduler | null = null;
let initialized = false;

export const initializeWhatsAppServices = () => {
  if (initialized) return;
  initialized = true;
  queue.initialize();
  scheduler = new WhatsAppReminderScheduler({
    enqueueOrSend: (payload) => queue.enqueueOrSend(payload),
  });
  scheduler.start();
  const sessionsDir = String(process.env.WHATSAPP_SESSIONS_DIR || '').trim() || 'sessions (default local)';
  console.log(`📁 WhatsApp sessions dir: ${sessionsDir}`);
  const workerId = Number(process.env.WHATSAPP_WORKER_ID || 0) || 0;
  const workerCount = Number(process.env.WHATSAPP_WORKER_COUNT || 1) || 1;
  console.log(`📦 WhatsApp scale profile: worker ${workerId + 1}/${Math.max(1, workerCount)}`);
};

export const getWhatsAppManager = () => manager;

export const sendWhatsAppMessage = async (userId: string, phone: string, message: string) => {
  return queue.enqueueOrSend({ userId, phone, message });
};
