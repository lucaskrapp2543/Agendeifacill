import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { checkMPPaymentStatus } from '../../src/lib/mercadopago/mp-service';
import { json, getQueryParam } from './_utils';

// Supabase Admin (bypass RLS)
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
    const paymentId = getQueryParam(event, 'paymentId');
    const establishmentId = getQueryParam(event, 'establishmentId');

    if (!paymentId || !establishmentId) {
      return json(400, {
        error: 'paymentId e establishmentId são obrigatórios',
      });
    }

    // Buscar access_token do estabelecimento
    if (!supabaseAdmin) {
      return json(500, {
        error: 'Supabase admin não configurado',
      });
    }

    const { data: establishment, error: fetchError } = await supabaseAdmin
      .from('establishments')
      .select('mercadopago_access_token')
      .eq('id', establishmentId)
      .single();

    if (fetchError || !establishment) {
      return json(404, {
        error: 'Estabelecimento não encontrado',
      });
    }

    const accessToken = (establishment as any)?.mercadopago_access_token;

    if (!accessToken) {
      return json(400, {
        error: 'Estabelecimento não possui conta do Mercado Pago conectada',
      });
    }

    // Verificar status
    const payment = await checkMPPaymentStatus(Number(paymentId), String(accessToken));

    return json(200, payment);
  } catch (error: any) {
    console.error('❌ [MP Check Status] Erro:', error);
    return json(500, {
      error: error.message || 'Erro ao verificar status do pagamento',
    });
  }
};
