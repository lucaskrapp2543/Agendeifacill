import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

function parseUnixTimestampToIso(value: unknown): string {
  const raw = String(value || '').trim();
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return new Date().toISOString();
  return new Date(n * 1000).toISOString();
}

function buildMetaStatusError(st: any): string | null {
  const errors = Array.isArray(st?.errors) ? st.errors : [];
  if (errors.length === 0) return null;

  const first = errors[0] || {};
  const code = String(first?.code || '').trim();
  const title = String(first?.title || '').trim();
  const details =
    String(first?.details || first?.message || first?.error_data?.details || '')
      .replace(/\s+/g, ' ')
      .trim();

  const composed = [code ? `code=${code}` : '', title ? `title=${title}` : '', details ? `details=${details}` : '']
    .filter(Boolean)
    .join(' | ');

  if (composed) return composed.slice(0, 500);
  return JSON.stringify(first).slice(0, 500);
}

export const handler: Handler = async event => {
  const verifyToken = String(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '').trim();

  if (event.httpMethod === 'GET') {
    const mode = String(event.queryStringParameters?.['hub.mode'] || '');
    const token = String(event.queryStringParameters?.['hub.verify_token'] || '');
    const challenge = String(event.queryStringParameters?.['hub.challenge'] || '');

    if (mode === 'subscribe' && verifyToken && token === verifyToken) {
      return { statusCode: 200, body: challenge };
    }
    return { statusCode: 403, body: 'forbidden' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'method_not_allowed' };
  }

  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!supabaseUrl || !serviceRoleKey) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'missing_supabase_env' }) };
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const statuses: any[] = [];

    for (const entry of payload?.entry || []) {
      for (const change of entry?.changes || []) {
        for (const st of change?.value?.statuses || []) {
          statuses.push(st);
        }
      }
    }

    if (statuses.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, updated: 0, reason: 'no_statuses' }) };
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let updated = 0;
    for (const st of statuses) {
      const metaMessageId = String(st?.id || '').trim();
      if (!metaMessageId) continue;

      const metaStatus = String(st?.status || '').trim().toLowerCase() || null;
      const metaRecipientId = String(st?.recipient_id || '').trim() || null;
      const metaConversationId = String(st?.conversation?.id || '').trim() || null;
      const metaPricingCategory = String(st?.pricing?.category || '').trim() || null;
      const metaStatusUpdatedAt = parseUnixTimestampToIso(st?.timestamp);
      const statusError = buildMetaStatusError(st);

      const updatePayload: Record<string, any> = {
        meta_status: metaStatus,
        meta_status_updated_at: metaStatusUpdatedAt,
        meta_recipient_id: metaRecipientId,
        meta_conversation_id: metaConversationId,
        meta_pricing_category: metaPricingCategory,
      };
      if (metaStatus === 'failed') {
        updatePayload.status = 'failed';
        if (statusError) updatePayload.last_error = statusError;
      } else if (metaStatus === 'delivered' || metaStatus === 'read') {
        // Mantém log limpo após recuperação de status.
        updatePayload.last_error = null;
      }

      const { error, count } = await supabase
        .from('whatsapp_reminder_logs')
        .update(updatePayload)
        .eq('meta_message_id', metaMessageId)
        .select('id', { count: 'exact', head: true });

      if (!error && (count || 0) > 0) {
        updated += Number(count || 0);
      } else if (error) {
        console.error('whatsapp-webhook: falha ao atualizar status', { metaMessageId, error });
      }
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, received: statuses.length, updated }) };
  } catch (e: any) {
    return {
      statusCode: 400,
      body: JSON.stringify({ ok: false, error: String(e?.message || e) }),
      headers: { 'content-type': 'application/json; charset=utf-8' },
    };
  }
};

