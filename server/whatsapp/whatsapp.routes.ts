import { createClient } from '@supabase/supabase-js';
import express from 'express';
import { getWhatsAppManager, sendWhatsAppMessage } from '../services/whatsapp';

const router = express.Router();
const REMINDER_OPTIONS_MINUTES = new Set([10, 30, 60, 180, 300, 720]);
const REQUIRED_REMINDER_TOKENS = [
  'cliente_nome',
  'barbearia_nome',
  'tempo_lembrete',
  'data',
  'horario',
  'profissional_nome',
];
const REQUIRED_GREETING_TOKENS = [
  'cliente_nome',
  'barbearia_nome',
  'data',
  'horario',
  'profissional_nome',
];
const DEFAULT_REMINDER_TEMPLATE =
  'Olá, {{cliente_nome}}! 👋✨\n' +
  'Passando para lembrar seu horário na {{barbearia_nome}}.\n' +
  '⏰ Falta {{tempo_lembrete}} para seu atendimento de hoje às {{horario}}.\n' +
  '📅 Data: {{data}}\n' +
  '💈 Profissional: {{profissional_nome}}\n\n' +
  'Te aguardamos! 🤝';
const DEFAULT_GREETING_TEMPLATE =
  'Opa, {{cliente_nome}}! 👋\n' +
  'Obrigado por agendar na {{barbearia_nome}}. Ficamos muito felizes! 🙏\n\n' +
  '📅 Data: {{data}}\n' +
  '⏰ Horário: {{horario}}\n' +
  '💈 Profissional: {{profissional_nome}}\n\n' +
  'Qualquer dúvida, estamos por aqui no WhatsApp 💬';

const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const SUPPORT_ADMIN_EMAILS = String(process.env.SUPPORT_ADMIN_EMAILS || 'suporteagendeifacil@gmail.com')
  .split(',')
  .map((email) => String(email || '').trim().toLowerCase())
  .filter(Boolean);

let supabaseAdminCache: any = null;
const getSupabaseAdmin = () => {
  if (supabaseAdminCache) return supabaseAdminCache;
  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || SUPABASE_URL || '').trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!supabaseUrl || !serviceRoleKey) return null;
  supabaseAdminCache = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return supabaseAdminCache;
};

const resolveRequestAuthUser = async (req: express.Request) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) throw new Error('Supabase admin não configurado.');
  const authHeader = String(req.headers.authorization || '').trim();
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) throw new Error('Token ausente.');

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user?.id) throw new Error('Token inválido.');

  return {
    id: String(data.user.id),
    email: String(data.user.email || '').toLowerCase().trim(),
  };
};

const resolveTargetUserId = async (req: express.Request): Promise<string> => {
  const requestedUserId = String(req.body?.user_id || req.query?.user_id || req.params?.userId || '').trim();
  const isUuid = (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());

  try {
    const authUser = await resolveRequestAuthUser(req);
    if (!requestedUserId) return authUser.id;

    if (requestedUserId === authUser.id) return requestedUserId;
    if (SUPPORT_ADMIN_EMAILS.includes(authUser.email)) return requestedUserId;
    throw new Error('Você não pode acessar sessão WhatsApp de outro usuário.');
  } catch (error: any) {
    const message = String(error?.message || error || '').trim();
    const canUseLegacyFallback =
      requestedUserId &&
      isUuid(requestedUserId) &&
      (message === 'Token ausente.' || message === 'Token inválido.');

    // Compatibilidade: alguns ambientes ainda autenticam por fluxo legado e não geram
    // um JWT válido do Supabase para estas rotas. Nesse caso, aceitamos user_id explícito.
    if (canUseLegacyFallback) {
      console.warn('[whatsapp/auth] fallback legado por user_id aplicado', {
        requestedUserId,
        reason: message,
      });
      return requestedUserId;
    }

    throw error;
  }
};

const normalizeAutomationSettings = (row: any, userId: string) => ({
  user_id: userId,
  reminder_enabled: row?.reminder_enabled !== false,
  reminder_offset_minutes: REMINDER_OPTIONS_MINUTES.has(Number(row?.reminder_offset_minutes))
    ? Number(row?.reminder_offset_minutes)
    : 60,
  reminder_template: String(row?.reminder_template || '').trim() || DEFAULT_REMINDER_TEMPLATE,
  greeting_enabled: row?.greeting_enabled !== false,
  greeting_template: String(row?.greeting_template || '').trim() || DEFAULT_GREETING_TEMPLATE,
});

const isMissingAutomationSettingsTable = (error: any) => {
  const code = String(error?.code || '').trim().toUpperCase();
  const msg = String(error?.message || '').toLowerCase();
  return code === '42P01' || (msg.includes('whatsapp_automation_settings') && msg.includes('does not exist'));
};

const isTransientSupabaseError = (error: any) => {
  const msg = String(error?.message || error || '').toLowerCase();
  if (!msg) return false;
  return (
    msg.includes('fetch failed') ||
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('econnreset') ||
    msg.includes('enotfound') ||
    msg.includes('socket')
  );
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeTemplateWithRequiredTokens = (
  template: string,
  tokens: string[],
  _contextLabel: 'lembrete' | 'saudação'
) => {
  let text = String(template || '');
  for (const token of tokens) {
    const singleBraceRegex = new RegExp(`\\{\\s*${token}\\s*\\}`, 'gi');
    text = text.replace(singleBraceRegex, `{{${token}}}`);
  }
  const missing = tokens.filter((token) => !text.includes(`{{${token}}}`));
  if (missing.length > 0) {
    const suffix = missing.map((token) => `{{${token}}}`).join(' ');
    text = `${text}\n${suffix}`.trim();
  }
  return text;
};

router.post('/connect', async (req, res) => {
  try {
    const userId = await resolveTargetUserId(req);
    const manager = getWhatsAppManager();
    const result = await manager.connect(userId);
    return res.status(200).json({
      ok: true,
      user_id: userId,
      status: manager.isConnected(userId) ? 'connected' : 'needs_qr',
      qr: result.qr,
      session_path: result.sessionPath,
    });
  } catch (error: any) {
    return res.status(400).json({ ok: false, error: String(error?.message || error) });
  }
});

router.get('/status', async (req, res) => {
  try {
    const userId = await resolveTargetUserId(req);
    const manager = getWhatsAppManager();
    const connected = manager.isConnected(userId);
    const qr = manager.getQr(userId);

    let dbSession: any = null;
    const supabaseAdmin = getSupabaseAdmin();
    if (supabaseAdmin) {
      const { data } = await supabaseAdmin
        .from('whatsapp_sessions')
        .select('status,phone,connected_at,last_seen,session_path')
        .eq('user_id', userId)
        .maybeSingle();
      dbSession = data;
    }

    return res.status(200).json({
      ok: true,
      user_id: userId,
      connected,
      qr,
      status: connected ? 'connected' : String(dbSession?.status || (qr ? 'needs_qr' : 'disconnected')),
      phone: dbSession?.phone || null,
      connected_at: dbSession?.connected_at || null,
      last_seen: dbSession?.last_seen || null,
      session_path: manager.getSessionPath(userId),
    });
  } catch (error: any) {
    return res.status(400).json({ ok: false, error: String(error?.message || error) });
  }
});

router.get('/qr', async (req, res) => {
  try {
    const userId = await resolveTargetUserId(req);
    const qr = getWhatsAppManager().getQr(userId);
    return res.status(200).json({ ok: true, user_id: userId, qr });
  } catch (error: any) {
    return res.status(400).json({ ok: false, error: String(error?.message || error) });
  }
});

router.post('/disconnect', async (req, res) => {
  try {
    const userId = await resolveTargetUserId(req);
    const clearSession = Boolean(req.body?.clear_session);
    await getWhatsAppManager().disconnect(userId, clearSession);
    return res.status(200).json({ ok: true, user_id: userId });
  } catch (error: any) {
    return res.status(400).json({ ok: false, error: String(error?.message || error) });
  }
});

router.post('/send', async (req, res) => {
  try {
    const userId = await resolveTargetUserId(req);
    const phone = String(req.body?.phone || '').trim();
    const message = String(req.body?.message || '').trim();
    if (!phone || !message) {
      return res.status(400).json({ ok: false, error: 'phone e message são obrigatórios.' });
    }
    console.info('[whatsapp/send] request', {
      userId,
      phone,
      messageLength: message.length,
    });
    const result = await sendWhatsAppMessage(userId, phone, message);
    if (!result.ok) {
      console.warn('[whatsapp/send] failed', {
        userId,
        phone,
        error: result.error || 'unknown_error',
      });
    } else {
      console.info('[whatsapp/send] success', {
        userId,
        phone,
        messageId: result.messageId || null,
        deliveryMode: result.deliveryMode || 'direct',
      });
    }
    return res.status(result.ok ? 200 : 400).json({ ok: result.ok, result });
  } catch (error: any) {
    console.error('[whatsapp/send] exception', {
      error: String(error?.message || error),
    });
    return res.status(400).json({ ok: false, error: String(error?.message || error) });
  }
});

router.get('/automation-settings', async (req, res) => {
  try {
    const userId = await resolveTargetUserId(req);
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) throw new Error('Supabase admin não configurado.');

    let data: any = null;
    let error: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const response = await supabaseAdmin
        .from('whatsapp_automation_settings')
        .select('user_id,reminder_enabled,reminder_offset_minutes,reminder_template,greeting_enabled,greeting_template')
        .eq('user_id', userId)
        .maybeSingle();
      data = response.data;
      error = response.error;
      if (!error) break;
      if (!isTransientSupabaseError(error) || attempt === 3) break;
      await sleep(attempt * 250);
    }
    if (error) {
      if (isMissingAutomationSettingsTable(error)) {
        return res.status(200).json({
          ok: true,
          settings: normalizeAutomationSettings(null, userId),
        });
      }
      if (isTransientSupabaseError(error)) {
        return res.status(503).json({
          ok: false,
          error: 'Falha temporária de rede ao carregar automação. Tente novamente em alguns segundos.',
        });
      }
      throw error;
    }

    return res.status(200).json({
      ok: true,
      settings: normalizeAutomationSettings(data, userId),
    });
  } catch (error: any) {
    return res.status(400).json({ ok: false, error: String(error?.message || error) });
  }
});

router.post('/automation-settings', async (req, res) => {
  try {
    const userId = await resolveTargetUserId(req);
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) throw new Error('Supabase admin não configurado.');

    const reminderEnabled = req.body?.reminder_enabled !== false;
    const reminderOffsetMinutes = Number(req.body?.reminder_offset_minutes ?? 60);
    const reminderTemplate = String(req.body?.reminder_template || '').trim();
    const greetingEnabled = req.body?.greeting_enabled !== false;
    const greetingTemplate = String(req.body?.greeting_template || '').trim();

    if (!REMINDER_OPTIONS_MINUTES.has(reminderOffsetMinutes)) {
      throw new Error('Tempo de lembrete inválido. Use 10, 30, 60, 180, 300 ou 720 minutos.');
    }

    const normalizedReminderTemplate = normalizeTemplateWithRequiredTokens(
      reminderTemplate || DEFAULT_REMINDER_TEMPLATE,
      REQUIRED_REMINDER_TOKENS,
      'lembrete'
    );
    const normalizedGreetingTemplate = normalizeTemplateWithRequiredTokens(
      greetingTemplate || DEFAULT_GREETING_TEMPLATE,
      REQUIRED_GREETING_TOKENS,
      'saudação'
    );

    const payload = {
      user_id: userId,
      reminder_enabled: Boolean(reminderEnabled),
      reminder_offset_minutes: reminderOffsetMinutes,
      reminder_template: normalizedReminderTemplate,
      greeting_enabled: Boolean(greetingEnabled),
      greeting_template: normalizedGreetingTemplate,
      updated_at: new Date().toISOString(),
    };

    let data: any = null;
    let error: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const response = await supabaseAdmin
        .from('whatsapp_automation_settings')
        .upsert(payload, { onConflict: 'user_id' })
        .select('user_id,reminder_enabled,reminder_offset_minutes,reminder_template,greeting_enabled,greeting_template')
        .maybeSingle();
      data = response.data;
      error = response.error;
      if (!error) break;
      if (!isTransientSupabaseError(error) || attempt === 3) break;
      await sleep(attempt * 250);
    }
    if (error) {
      if (isMissingAutomationSettingsTable(error)) {
        throw new Error(
          'Tabela whatsapp_automation_settings não encontrada. Aplique a migration de automação do WhatsApp no Supabase.'
        );
      }
      if (isTransientSupabaseError(error)) {
        throw new Error('Falha temporária de rede ao salvar automação. Tente novamente em alguns segundos.');
      }
      throw error;
    }

    return res.status(200).json({
      ok: true,
      settings: normalizeAutomationSettings(data, userId),
    });
  } catch (error: any) {
    return res.status(400).json({ ok: false, error: String(error?.message || error) });
  }
});

router.get('/message-logs', async (req, res) => {
  try {
    const userId = await resolveTargetUserId(req);
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) throw new Error('Supabase admin não configurado.');

    const rawLimit = Number(req.query?.limit ?? 50);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 50;

    const { data, error } = await supabaseAdmin
      .from('whatsapp_message_logs')
      .select('id,appointment_id,message_type,status,recipient_phone,error,sent_at,created_at,provider')
      .eq('sender_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;

    return res.status(200).json({
      ok: true,
      logs: data || [],
    });
  } catch (error: any) {
    return res.status(400).json({ ok: false, error: String(error?.message || error) });
  }
});

export default router;
