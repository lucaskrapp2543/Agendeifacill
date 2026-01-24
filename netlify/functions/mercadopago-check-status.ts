import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { refreshAccessToken } from '../../src/lib/mercadopago/mp-oauth';
import { checkMPPaymentStatus } from '../../src/lib/mercadopago/mp-service';
import { getQueryParam, json } from './_utils';

// Supabase Admin (bypass RLS)
const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    : null;

async function getValidMercadoPagoAccessToken(establishmentId: string): Promise<string> {
  if (!supabaseAdmin) throw new Error('Supabase admin não configurado');

  const { data: establishment, error } = await supabaseAdmin
    .from('establishments')
    .select('mercadopago_access_token, mercadopago_refresh_token, mercadopago_token_expires_at')
    .eq('id', establishmentId)
    .single();

  if (error || !establishment) throw new Error('Estabelecimento não encontrado');

  const accessToken = String((establishment as any)?.mercadopago_access_token || '').trim();
  const refreshToken = String((establishment as any)?.mercadopago_refresh_token || '').trim();
  const expiresAtRaw = (establishment as any)?.mercadopago_token_expires_at as string | null | undefined;

  if (!accessToken) throw new Error('Estabelecimento não possui conta do Mercado Pago conectada');
  if (!expiresAtRaw) return accessToken;

  const expiresAt = new Date(expiresAtRaw);
  const now = Date.now();
  const safetyMs = 2 * 60 * 1000;
  if (Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() > now + safetyMs) {
    return accessToken;
  }

  if (!refreshToken) throw new Error('Mercado Pago expirado e sem refresh_token. Reconecte o Mercado Pago.');

  const refreshed = await refreshAccessToken(refreshToken);
  const newAccessToken = String(refreshed.access_token || '').trim();
  const newRefreshToken = String(refreshed.refresh_token || refreshToken).trim();
  const expiresIn = Number(refreshed.expires_in || 21600);
  const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  if (!newAccessToken) throw new Error('Falha ao atualizar token do Mercado Pago');

  await supabaseAdmin
    .from('establishments')
    .update({
      mercadopago_access_token: newAccessToken,
      mercadopago_refresh_token: newRefreshToken,
      mercadopago_token_expires_at: newExpiresAt,
    } as any)
    .eq('id', establishmentId);

  console.log('✅ [MP Check Status] access_token renovado automaticamente', { establishmentId });
  return newAccessToken;
}

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

    let accessToken: string;
    try {
      accessToken = await getValidMercadoPagoAccessToken(String(establishmentId));
    } catch (e: any) {
      return json(400, {
        error: String(e?.message || 'Falha ao obter token do Mercado Pago'),
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
