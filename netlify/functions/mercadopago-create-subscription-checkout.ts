import type { Handler } from '@netlify/functions';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { refreshAccessToken } from '../../src/lib/mercadopago/mp-oauth';
import { json, parseJsonBody } from './_utils';

const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const MP_API_BASE_URL = String(process.env.MERCADOPAGO_API_BASE_URL || 'https://api.mercadopago.com').trim();
const SUBSCRIPTION_BACK_URL = String(process.env.MERCADOPAGO_SUBSCRIPTION_BACK_URL || '').trim();

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

  if (error || !establishment) {
    throw new Error('Estabelecimento não encontrado');
  }

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
    const subscriptionId = String(body?.subscriptionId || '').trim();
    const payerEmail = String(body?.payer?.email || '').trim();
    const payerName = String(body?.payer?.name || '').trim();
    const backUrlRaw = String(body?.backUrl || '').trim();

    if (!establishmentId || !subscriptionId || !payerEmail) {
      return json(400, {
        error: 'Dados incompletos',
        required: ['establishmentId', 'subscriptionId', 'payer.email'],
      });
    }

    const { data: subscriptionRow, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('id, name, value')
      .eq('id', subscriptionId)
      .single();

    if (subError || !subscriptionRow) {
      return json(404, { error: 'Assinatura não encontrada' });
    }

    const amount = Number((subscriptionRow as any)?.value || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return json(400, { error: 'Valor da assinatura inválido' });
    }
    const applicationFeeCentsRaw =
      process.env.MERCADOPAGO_CREDIT_PLATFORM_FEE_CENTS ||
      process.env.PLATFORM_CREDIT_FEE_CENTS ||
      '100';
    const applicationFeeCentsParsed = Number(String(applicationFeeCentsRaw).trim());
    const txAmountBrl = Number(amount.toFixed(2));
    const rawFeeBrl = Number.isFinite(applicationFeeCentsParsed)
      ? Number((applicationFeeCentsParsed / 100).toFixed(2))
      : 1;
    let applicationFee = rawFeeBrl > 0 && rawFeeBrl < txAmountBrl ? rawFeeBrl : 0;
    if (rawFeeBrl > 0 && applicationFee === 0) {
      console.warn('[MP preapproval] application_fee omitida: valor da assinatura insuficiente para o split', {
        txAmountBrl,
        rawFeeBrl,
        establishmentId,
        subscriptionId,
      });
    }

    const accessToken = await getValidMercadoPagoAccessToken(establishmentId);
    const now = Date.now();
    const externalReference = `subscription_preapproval:${establishmentId}:${subscriptionId}:${now}`;
    const title = String((subscriptionRow as any)?.name || 'Assinatura').trim();
    const backUrlCandidate = backUrlRaw || SUBSCRIPTION_BACK_URL;
    const backUrl = /^https:\/\//i.test(backUrlCandidate) ? backUrlCandidate : undefined;

    const payload: any = {
      reason: `Assinatura mensal - ${title}`,
      payer_email: payerEmail,
      external_reference: externalReference,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: txAmountBrl,
        currency_id: 'BRL',
      },
      metadata: {
        type: 'subscription_preapproval',
        establishment_id: establishmentId,
        subscription_id: subscriptionId,
        payer_name: payerName || null,
      },
      status: 'pending',
    };
    if (applicationFee > 0) {
      payload.application_fee = applicationFee;
    }

    if (!backUrl) {
      return json(400, {
        error: 'back_url is required',
        userMessage: 'Configure MERCADOPAGO_SUBSCRIPTION_BACK_URL com URL HTTPS pública para testes locais e produção.',
      });
    }
    payload.back_url = backUrl;

    const response = await axios.post(`${MP_API_BASE_URL}/preapproval`, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `sub_preapproval_${externalReference}`,
      },
    });

    const preapproval = response.data || {};
    const initPoint = String(preapproval?.init_point || preapproval?.sandbox_init_point || '').trim();
    if (!initPoint) {
      return json(500, { error: 'Mercado Pago não retornou init_point' });
    }

    return json(200, {
      preapproval_id: String(preapproval?.id || ''),
      init_point: initPoint,
      sandbox_init_point: String(preapproval?.sandbox_init_point || ''),
      external_reference: externalReference,
      subscription_status: String(preapproval?.status || 'pending'),
      amount_brl_used: amount,
      amount_cents_used: Math.round(amount * 100),
      application_fee_brl_used: applicationFee,
      application_fee_cents_used: Math.round(applicationFee * 100),
      application_fee_applied: applicationFee > 0,
    });
  } catch (error: any) {
    const message =
      String(error?.response?.data?.message || '') ||
      String(error?.response?.data?.error || '') ||
      String(error?.message || 'Erro ao criar checkout externo da assinatura');
    return json(500, { error: message });
  }
};
