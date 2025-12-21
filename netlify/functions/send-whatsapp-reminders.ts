import type { Handler } from '@netlify/functions';
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
    // Proteção opcional contra disparo público (recomendado).
    // Configure no Netlify: WHATSAPP_REMINDERS_CRON_TOKEN
    // E chame a function como:
    //   /.netlify/functions/send-whatsapp-reminders?token=SEU_TOKEN
    const tokenEnv = process.env.WHATSAPP_REMINDERS_CRON_TOKEN;
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
    const result = await runSendWhatsappRemindersOnce();
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


