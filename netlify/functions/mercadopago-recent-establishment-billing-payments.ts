import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { getQueryParam, json } from './_utils';

const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    : null;

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method Not Allowed' }, { Allow: 'GET' });
  }

  try {
    if (!supabaseAdmin) {
      return json(500, { error: 'Supabase admin nao configurado' });
    }

    const rawDays = Number(getQueryParam(event, 'days') || '10');
    const days = Number.isFinite(rawDays) ? Math.min(30, Math.max(1, Math.floor(rawDays))) : 10;
    const nowTs = Date.now();
    const startTs = nowTs - (days * 24 * 60 * 60 * 1000);

    const { data, error } = await supabaseAdmin
      .from('establishment_billing_payments')
      .select('establishment_id, paid_at, updated_at, status, payment_provider, metadata')
      .eq('status', 'paid')
      .order('updated_at', { ascending: false })
      .limit(1000);

    if (error) {
      return json(500, { error: 'Erro ao buscar pagamentos automaticos', details: String(error.message || error) });
    }

    const latestByEstablishment = new Map<string, { establishment_id: string; paid_at: string | null; updated_at: string | null; payment_provider: string; payment_method: string }>();
    (data || []).forEach((row: any) => {
      const establishmentId = String(row?.establishment_id || '').trim();
      if (!establishmentId) return;

      const ts = new Date(String(row?.paid_at || row?.updated_at || '')).getTime();
      if (!Number.isFinite(ts) || ts < startTs || ts > nowTs) return;

      const current = latestByEstablishment.get(establishmentId);
      const currentTs = current ? new Date(String(current.paid_at || current.updated_at || '')).getTime() : NaN;
      if (!current || !Number.isFinite(currentTs) || ts > currentTs) {
        latestByEstablishment.set(establishmentId, {
          establishment_id: establishmentId,
          paid_at: row?.paid_at ? String(row.paid_at) : null,
          updated_at: row?.updated_at ? String(row.updated_at) : null,
          payment_provider: String(row?.payment_provider || 'mercadopago'),
          payment_method: String(row?.metadata?.payment_method || ''),
        });
      }
    });

    const items = Array.from(latestByEstablishment.values()).sort((a, b) => {
      const ta = new Date(String(a.paid_at || a.updated_at || '')).getTime();
      const tb = new Date(String(b.paid_at || b.updated_at || '')).getTime();
      return tb - ta;
    });

    return json(200, { days, count: items.length, items });
  } catch (error: any) {
    return json(500, { error: String(error?.message || 'Erro interno') });
  }
};

