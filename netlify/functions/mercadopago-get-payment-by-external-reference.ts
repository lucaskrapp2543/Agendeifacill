import type { Handler } from '@netlify/functions';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { refreshAccessToken } from '../../src/lib/mercadopago/mp-oauth';
import { json, parseJsonBody } from './_utils';

const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const MP_API_BASE_URL = String(process.env.MERCADOPAGO_API_BASE_URL || 'https://api.mercadopago.com').trim();

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
    .select('id, mercadopago_access_token, mercadopago_refresh_token, mercadopago_token_expires_at')
    .eq('id', establishmentId)
    .single();

  if (error || !establishment) throw new Error('Estabelecimento não encontrado');

  const accessToken = String((establishment as any)?.mercadopago_access_token || '').trim();
  const refreshToken = String((establishment as any)?.mercadopago_refresh_token || '').trim();
  const expiresAtRaw = (establishment as any)?.mercadopago_token_expires_at as string | null | undefined;
  if (!accessToken) throw new Error('Estabelecimento sem Mercado Pago conectado');
  if (!expiresAtRaw) return accessToken;

  const expiresAt = new Date(expiresAtRaw).getTime();
  const now = Date.now();
  const safetyMs = 2 * 60 * 1000;
  if (Number.isFinite(expiresAt) && expiresAt > now + safetyMs) return accessToken;
  if (!refreshToken) throw new Error('Token Mercado Pago expirado. Reconecte a conta.');

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

  return newAccessToken;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' }, { Allow: 'POST' });
  }

  try {
    if (!supabaseAdmin) return json(500, { error: 'Supabase admin não configurado' });

    const body = parseJsonBody<any>(event) || {};
    const establishmentId = String(body?.establishmentId || '').trim();
    const externalReference = String(body?.externalReference || '').trim();
    if (!establishmentId || !externalReference) {
      return json(400, { error: 'Dados incompletos', required: ['establishmentId', 'externalReference'] });
    }

    const accessToken = await getValidMercadoPagoAccessToken(establishmentId);
    const response = await axios.get(`${MP_API_BASE_URL}/v1/payments/search`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      params: {
        external_reference: externalReference,
        sort: 'date_created',
        criteria: 'desc',
        limit: 1,
      },
    });

    const results = Array.isArray(response?.data?.results) ? response.data.results : [];
    const payment = results[0] || null;
    if (!payment) {
      return json(200, {
        found: false,
        payment: null,
      });
    }

    return json(200, {
      found: true,
      payment: {
        id: String(payment?.id || ''),
        status: String(payment?.status || ''),
        status_detail: String(payment?.status_detail || ''),
        date_approved: payment?.date_approved || null,
        transaction_amount: payment?.transaction_amount || null,
      },
    });
  } catch (error: any) {
    const message =
      String(error?.response?.data?.message || '') ||
      String(error?.response?.data?.error || '') ||
      String(error?.message || 'Erro ao consultar pagamento por external_reference');
    return json(500, { error: message });
  }
};
