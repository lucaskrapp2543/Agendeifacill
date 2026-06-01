import type { Handler } from '@netlify/functions';
import axios from 'axios';
import { randomUUID } from 'crypto';
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

const onlyDigits = (v: string) => String(v || '').replace(/\D/g, '');
const toISODate = (d: Date) => d.toISOString().slice(0, 10);
const addMonths = (date: Date, months: number) => {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d;
};

async function upsertPendingClientSubscription(input: {
  establishmentId: string;
  subscriptionId: string;
  preapprovalId: string;
  customerName: string;
  customerWhatsapp: string;
  customerEmail: string | null;
  durationMonths: number;
}) {
  if (!supabaseAdmin) throw new Error('Supabase admin não configurado');

  const phone = onlyDigits(input.customerWhatsapp);
  if (!input.establishmentId || !input.subscriptionId || !input.preapprovalId || !input.customerName || !phone) {
    throw new Error('Dados insuficientes para criar assinante pendente');
  }

  const today = new Date();
  const startDate = toISODate(today);
  const endDate = toISODate(addMonths(today, Number.isFinite(input.durationMonths) && input.durationMonths > 0 ? input.durationMonths : 1));

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('client_subscriptions')
    .select('id')
    .eq('establishment_id', input.establishmentId)
    .eq('subscription_id', input.subscriptionId)
    .eq('subscriber_whatsapp', phone)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    console.warn('[MP subscription checkout] Não foi possível procurar assinante pendente existente:', existingError);
  }

  const payload: any = {
    subscription_id: input.subscriptionId,
    establishment_id: input.establishmentId,
    start_date: startDate,
    end_date: endDate,
    payment_status: 'unpaid',
    last_payment_date: null,
    subscriber_name: input.customerName,
    subscriber_whatsapp: phone,
    subscriber_email: input.customerEmail,
    subscriber_payment_method: 'credito',
    subscription_payment_provider: 'mercadopago_card_recurring',
    subscription_payment_order_id: input.preapprovalId,
  };

  if (existing?.id) {
    const { data, error } = await supabaseAdmin
      .from('client_subscriptions')
      .update(payload)
      .eq('id', String(existing.id))
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabaseAdmin
    .from('client_subscriptions')
    .insert([{ client_id: randomUUID(), ...payload }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

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
    const cardTokenId = String(body?.card_token_id || body?.cardTokenId || '').trim();
    const deviceSessionId = String(body?.device_session_id || body?.deviceSessionId || '').trim();
    const customerName = String(body?.customer?.name || payerName || '').trim();
    const customerWhatsapp = onlyDigits(String(body?.customer?.whatsapp || body?.customer?.phone || ''));
    const customerEmail = String(body?.customer?.email || payerEmail || '').trim() || null;
    const payerFirstName = String(body?.payer?.first_name || body?.payer?.firstName || '').trim();
    const payerLastName = String(body?.payer?.last_name || body?.payer?.lastName || '').trim();
    const payerDocumentType = String(body?.payer?.identification?.type || '').trim().toUpperCase();
    const payerDocumentNumber = onlyDigits(String(body?.payer?.identification?.number || ''));
    const payerAddress = body?.payer?.address || {};
    const cardInfo = body?.card || {};
    const backUrlRaw = String(body?.backUrl || '').trim();

    if (!establishmentId || !subscriptionId || !payerEmail) {
      return json(400, {
        error: 'Dados incompletos',
        required: ['establishmentId', 'subscriptionId', 'payer.email'],
      });
    }

    const { data: subscriptionRow, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('id, name, value, duration_months')
      .eq('id', subscriptionId)
      .single();

    if (subError || !subscriptionRow) {
      return json(404, { error: 'Assinatura não encontrada' });
    }

    const amount = Number((subscriptionRow as any)?.value || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return json(400, { error: 'Valor da assinatura inválido' });
    }
    const txAmountBrl = Number(amount.toFixed(2));

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
        payer_first_name: payerFirstName || null,
        payer_last_name: payerLastName || null,
        payer_document_type: payerDocumentType || null,
        payer_document_last4: payerDocumentNumber ? payerDocumentNumber.slice(-4) : null,
        payer_phone_last4: customerWhatsapp ? customerWhatsapp.slice(-4) : null,
        billing_zip_code: String(payerAddress?.zip_code || '').trim() || null,
        billing_city: String(payerAddress?.city || '').trim() || null,
        billing_federal_unit: String(payerAddress?.federal_unit || '').trim() || null,
        card_payment_method_id: String(cardInfo?.payment_method_id || '').trim() || null,
        card_issuer_id: String(cardInfo?.issuer_id || '').trim() || null,
        card_bin: String(cardInfo?.bin || '').trim().slice(0, 6) || null,
        card_last4: String(cardInfo?.last_four_digits || cardInfo?.lastFourDigits || '').trim().slice(-4) || null,
        has_device_session_id: Boolean(deviceSessionId),
      },
      status: cardTokenId ? 'authorized' : 'pending',
    };
    if (cardTokenId) payload.card_token_id = cardTokenId;

    if (!cardTokenId && !backUrl) {
      return json(400, {
        error: 'back_url is required',
        userMessage: 'Configure MERCADOPAGO_SUBSCRIPTION_BACK_URL com URL HTTPS pública para testes locais e produção.',
      });
    }
    if (backUrl) payload.back_url = backUrl;

    const mpHeaders: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': `sub_preapproval_${externalReference}`,
    };
    if (deviceSessionId) {
      mpHeaders['X-meli-session-id'] = deviceSessionId;
    }

    const response = await axios.post(`${MP_API_BASE_URL}/preapproval`, payload, {
      headers: {
        ...mpHeaders,
      },
    });

    const preapproval = response.data || {};
    const initPoint = String(preapproval?.init_point || preapproval?.sandbox_init_point || '').trim();
    if (!cardTokenId && !initPoint) {
      return json(500, { error: 'Mercado Pago não retornou init_point' });
    }

    let pendingSubscriber: any = null;
    if (cardTokenId) {
      try {
        pendingSubscriber = await upsertPendingClientSubscription({
          establishmentId,
          subscriptionId,
          preapprovalId: String(preapproval?.id || ''),
          customerName,
          customerWhatsapp,
          customerEmail,
          durationMonths: Number((subscriptionRow as any)?.duration_months || 1),
        });
      } catch (pendingError: any) {
        return json(500, {
          error: 'Recorrência criada no Mercado Pago, mas falhou ao criar o assinante como Não Pago no sistema',
          details: pendingError?.message || pendingError,
          preapproval_id: String(preapproval?.id || ''),
          subscription_status: String(preapproval?.status || 'pending'),
        });
      }
    }

    return json(200, {
      preapproval_id: String(preapproval?.id || ''),
      init_point: initPoint,
      sandbox_init_point: String(preapproval?.sandbox_init_point || ''),
      external_reference: externalReference,
      subscription_status: String(preapproval?.status || 'pending'),
      recurring_mode: cardTokenId ? 'card_token' : 'hosted_checkout',
      recurrence_created: Boolean(String(preapproval?.id || '').trim()),
      amount_brl_used: amount,
      amount_cents_used: Math.round(amount * 100),
      application_fee_brl_used: 0,
      application_fee_cents_used: 0,
      application_fee_applied: false,
      pending_subscriber_created: Boolean(pendingSubscriber?.id),
      pending_subscriber_id: pendingSubscriber?.id || null,
    });
  } catch (error: any) {
    const message =
      String(error?.response?.data?.message || '') ||
      String(error?.response?.data?.error || '') ||
      String(error?.message || 'Erro ao criar checkout externo da assinatura');
    const status = Number(error?.response?.status || 500);
    const lower = message.toLowerCase();
    const supportsRecurringHint =
      status === 401 ||
      status === 403 ||
      lower.includes('preapproval') ||
      lower.includes('recurring') ||
      lower.includes('subscription') ||
      lower.includes('not authorized') ||
      lower.includes('not allowed');

    return json(status >= 400 && status < 600 ? status : 500, {
      error: message,
      userMessage: supportsRecurringHint
        ? 'A conta Mercado Pago conectada do barbeiro não conseguiu criar assinatura recorrente agora. Peça para reconectar o Mercado Pago e habilitar Assinaturas/Preapproval na aplicação.'
        : undefined,
      recurring_capability_error: supportsRecurringHint,
    });
  }
};
