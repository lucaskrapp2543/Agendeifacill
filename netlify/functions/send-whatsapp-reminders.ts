import type { Handler } from '@netlify/functions';
import { runSendExpiredSubscriptionRemindersOnce } from '../../modules/whatsapp-reminders/jobs/sendExpiredSubscriptionReminders';
import { runSendWhatsappRemindersOnce } from '../../modules/whatsapp-reminders/jobs/sendWhatsappReminders';

/**
 * Netlify Scheduled Function (cron)
 * Roda a cada 5 minutos e dispara o job de lembretes WhatsApp.
 *
 * Variáveis obrigatórias no Netlify (Site settings → Environment variables):
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - WASENDER_BASE_URL
 * - WHATSAPP_REMINDERS_MASTER_KEY
 *
 * (Opcional)
 * - WHATSAPP_REMINDERS_DELAY_MS
 * - WHATSAPP_REMINDERS_TIMEZONE (default America/Sao_Paulo)
 */
export const handler: Handler = async (event) => {
  try {
    // Proteção contra disparo público.
    // Aceita token por query/header/bearer e múltiplas envs por compatibilidade.
    const configuredTokens = [
      process.env.WHATSAPP_REMINDERS_CRON_TOKEN,
      process.env.WHATSAPP_REMINDERS_MASTER_KEY,
      process.env.WHATSAPP_REMINDERS_TOKEN,
    ]
      .map(v => String(v || '').trim())
      .filter(Boolean);

    const decode = (v: string) => {
      try {
        return decodeURIComponent(v);
      } catch {
        return v;
      }
    };

    const authHeader = String(event.headers?.authorization || event.headers?.Authorization || '').trim();
    const bearerToken = authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : '';

    const providedCandidates = [
      String(event.queryStringParameters?.token || ''),
      String(event.queryStringParameters?.key || ''),
      String(event.headers?.['x-cron-token'] || ''),
      String(event.headers?.['x-reminder-token'] || ''),
      bearerToken,
    ]
      .map(v => decode(String(v || '').trim()))
      .filter(Boolean);

    if (configuredTokens.length > 0) {
      const ok = providedCandidates.some(candidate => configuredTokens.includes(candidate));
      if (!ok) {
        return {
          statusCode: 401,
          body: JSON.stringify({
            ok: false,
            error: 'unauthorized',
            hint: 'token_invalido_ou_nao_informado',
            auth_debug: {
              configured_tokens: configuredTokens.length,
              provided_candidates: providedCandidates.length,
              has_authorization_header: Boolean(authHeader),
            },
          }),
          headers: { 'content-type': 'application/json; charset=utf-8' },
        };
      }
    }
    const result = await runSendWhatsappRemindersOnce();
    let expiredSubscriptions: any = { skipped: true, reason: 'not_executed' };
    try {
      expiredSubscriptions = await runSendExpiredSubscriptionRemindersOnce();
    } catch (expiredError: any) {
      // Nao interrompe o lembrete de agendamento ja existente.
      expiredSubscriptions = {
        skipped: true,
        reason: 'execution_error',
        error: String(expiredError?.message || expiredError),
      };
    }
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, result, expiredSubscriptions }),
      headers: { 'content-type': 'application/json; charset=utf-8' },
    };
  } catch (e: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: String(e?.message || e) }),
      headers: { 'content-type': 'application/json; charset=utf-8' },
    };
  }
};

// Cron a cada 5 minutos
export const config = {
  schedule: '*/5 * * * *',
};


