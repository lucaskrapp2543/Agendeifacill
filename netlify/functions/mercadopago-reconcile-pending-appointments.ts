import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { reconcilePendingMercadoPagoAppointments } from '../../src/lib/mercadopago/reconcilePendingAppointmentsMp';
import { json, parseJsonBody } from './_utils';

const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' }, { Allow: 'POST' });
  }

  try {
    if (!supabaseAdmin) {
      return json(500, { error: 'Supabase admin não configurado' });
    }

    const body = parseJsonBody<{ establishmentId?: string; maxRows?: number; lookbackDays?: number }>(event) || {};
    const establishmentId = String(body.establishmentId || '').trim();
    if (!establishmentId) {
      return json(400, { error: 'establishmentId é obrigatório' });
    }

    const result = await reconcilePendingMercadoPagoAppointments(supabaseAdmin, establishmentId, {
      maxRows: body.maxRows,
      lookbackDays: body.lookbackDays,
    });

    return json(200, result);
  } catch (error: any) {
    console.error('❌ [MP Reconcile Pending] Erro:', error);
    return json(500, {
      error: error?.message || 'Erro ao reconciliar agendamentos pendentes',
    });
  }
};
