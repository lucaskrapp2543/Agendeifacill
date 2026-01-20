import type { Handler } from '@netlify/functions';
import { runSendWaitlistWhatsappNotificationsOnce } from '../../modules/waitlist/jobs/sendWaitlistWhatsappNotifications';

/**
 * Netlify Scheduled Function (cron)
 * Roda a cada 5 minutos e dispara o job de notificações WhatsApp da FILA DE ESPERA.
 *
 * Variáveis obrigatórias no Netlify (Site settings → Environment variables):
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - WASENDER_BASE_URL
 * - WHATSAPP_REMINDERS_MASTER_KEY  (chave para descriptografar api_key_encrypted)
 *
 * (Opcional)
 * - WHATSAPP_WAITLIST_DELAY_MS
 *
 * Segurança opcional:
 * - WHATSAPP_WAITLIST_CRON_TOKEN
 *   chame: /.netlify/functions/send-waitlist-whatsapp-notifications?token=SEU_TOKEN
 */
export const handler: Handler = async (event) => {
  try {
    const tokenEnv = process.env.WHATSAPP_WAITLIST_CRON_TOKEN;
    if (tokenEnv) {
      const token = event.queryStringParameters?.token || '';
      if (token !== tokenEnv) {
        return {
          statusCode: 401,
          body: JSON.stringify({ ok: false, error: 'unauthorized' }),
          headers: { 'content-type': 'application/json; charset=utf-8' },
        };
      }
    }

    const result = await runSendWaitlistWhatsappNotificationsOnce();
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, result }),
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

