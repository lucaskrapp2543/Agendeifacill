import type { Handler } from '@netlify/functions';
import axios from 'axios';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { refreshAccessToken } from '../../src/lib/mercadopago/mp-oauth';
import { markMercadoPagoHealthBestEffort } from './mercadopago-create-payment';
import { json, parseJsonBody } from './_utils';

const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const MP_API_BASE_URL = String(process.env.MERCADOPAGO_API_BASE_URL || 'https://api.mercadopago.com').trim();
const SUBSCRIPTION_BACK_URL = String(process.env.MERCADOPAGO_SUBSCRIPTION_BACK_URL || '').trim();

/**
 * Para onde o Mercado Pago avisa sobre esta recorrência (ativação e cobrança mensal).
 *
 * Sem isto, o aviso só chega se a conta/aplicação tiver o tópico de assinaturas
 * marcado no painel do Mercado Pago — algo que nenhuma barbearia configura. Era
 * uma das razões de a renovação não dar baixa sozinha.
 *
 * Derivado do back_url para não precisar de variável nova em produção: os dois
 * apontam para o mesmo site. Só é enviado se resultar numa URL https válida.
 */
const resolveNotificationUrl = (backUrl?: string): string | null => {
  const explicito = String(process.env.MERCADOPAGO_WEBHOOK_URL || '').trim();
  if (/^https:\/\//i.test(explicito)) return explicito;
  const base = String(backUrl || SUBSCRIPTION_BACK_URL || '').trim();
  if (!/^https:\/\//i.test(base)) return null;
  try {
    return `${new URL(base).origin}/.netlify/functions/mercadopago-webhook`;
  } catch {
    return null;
  }
};

const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

const onlyDigits = (v: string) => String(v || '').replace(/\D/g, '');
const toISODate = (d: Date) => d.toISOString().slice(0, 10);
const toISODateTime = (d: Date) => d.toISOString();
const addMonths = (date: Date, months: number) => {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d;
};

/**
 * A coluna `recurring_preapproval_id` é criada pela migration
 * 20260827_client_subscriptions_recurring_preapproval_id.sql. Se o código subir
 * antes do SQL rodar, a gravação falharia e o cliente não conseguiria ativar a
 * recorrência — então aqui a falta da coluna é detectada e o fluxo continua sem
 * ela, do jeito que funcionava antes.
 */
const isMissingRecurringColumnError = (error: any): boolean => {
  const msg = String(error?.message || error || '').toLowerCase();
  return msg.includes('recurring_preapproval_id') &&
    (msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('column'));
};

async function upsertPendingClientSubscription(input: {
  establishmentId: string;
  subscriptionId: string;
  preapprovalId: string;
  recurringProvider: 'mercadopago_card_recurring' | 'mercadopago_card_recurring_pending';
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
    .select('id, payment_status, last_payment_date, start_date, end_date')
    .eq('establishment_id', input.establishmentId)
    .eq('subscription_id', input.subscriptionId)
    .eq('subscriber_whatsapp', phone)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    console.warn('[MP subscription checkout] Não foi possível procurar assinante pendente existente:', existingError);
  }

  const isAlreadyPaid = String((existing as any)?.payment_status || '').toLowerCase() === 'paid';
  const payload: any = {
    subscription_id: input.subscriptionId,
    establishment_id: input.establishmentId,
    start_date: isAlreadyPaid ? ((existing as any)?.start_date || startDate) : startDate,
    end_date: isAlreadyPaid ? ((existing as any)?.end_date || endDate) : endDate,
    payment_status: isAlreadyPaid ? 'paid' : 'unpaid',
    last_payment_date: isAlreadyPaid ? ((existing as any)?.last_payment_date || startDate) : null,
    subscriber_name: input.customerName,
    subscriber_whatsapp: phone,
    subscriber_email: input.customerEmail,
    subscriber_payment_method: 'credito',
    subscription_payment_provider: input.recurringProvider,
    subscription_payment_order_id: input.preapprovalId,
    // Vínculo da recorrência em coluna própria: pagamento avulso encontra o
    // assinante pelo telefone e reescreve a linha inteira, o que apagava o
    // preapproval de subscription_payment_order_id e deixava a recorrência órfã.
    recurring_preapproval_id: input.preapprovalId,
  };

  if (existing?.id) {
    const { data, error } = await supabaseAdmin
      .from('client_subscriptions')
      .update(payload)
      .eq('id', String(existing.id))
      .select()
      .single();
    if (error) {
      if (!isMissingRecurringColumnError(error)) throw error;
      const legacy = { ...payload };
      delete legacy.recurring_preapproval_id;
      const retry = await supabaseAdmin
        .from('client_subscriptions')
        .update(legacy)
        .eq('id', String(existing.id))
        .select()
        .single();
      if (retry.error) throw retry.error;
      return retry.data;
    }
    return data;
  }

  const { data, error } = await supabaseAdmin
    .from('client_subscriptions')
    .insert([{ client_id: randomUUID(), ...payload }])
    .select()
    .single();
  if (error) {
    if (!isMissingRecurringColumnError(error)) throw error;
    const legacy = { ...payload };
    delete legacy.recurring_preapproval_id;
    const retry = await supabaseAdmin
      .from('client_subscriptions')
      .insert([{ client_id: randomUUID(), ...legacy }])
      .select()
      .single();
    if (retry.error) throw retry.error;
    return retry.data;
  }
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
  if (!refreshToken) {
    // Sem refresh_token não há renovação possível: estado permanente até reconectar.
    await markMercadoPagoHealthBestEffort(
      establishmentId,
      'reconnect_required',
      'Token expirado e sem refresh_token salvo. Necessário reconectar o Mercado Pago.'
    );
    throw new Error('Token Mercado Pago expirado. Reconecte a conta.');
  }

  let refreshed;
  try {
    refreshed = await refreshAccessToken(refreshToken);
  } catch (refreshError: any) {
    // Só marca "precisa reconectar" em erro PERMANENTE do OAuth (invalid_grant).
    // Erro de rede/instabilidade do MP passa reto — não pode virar alarme falso.
    if (refreshError?.mpReconnectRequired === true) {
      await markMercadoPagoHealthBestEffort(
        establishmentId,
        'reconnect_required',
        String(refreshError?.message || 'invalid_grant')
      );
    }
    throw refreshError;
  }
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

  // Renovou com sucesso = conexão saudável (limpa alerta antigo, se houver).
  // Update separado de propósito para nunca afetar o salvamento dos tokens.
  await markMercadoPagoHealthBestEffort(establishmentId, 'ok', null);

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
    const existingClientSubscriptionId = String(body?.existingClientSubscriptionId || '').trim();
    const firstPaymentAlreadyCaptured =
      body?.first_payment_already_captured === true ||
      body?.firstPaymentAlreadyCaptured === true;
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
    const recurringStartDate = firstPaymentAlreadyCaptured ? toISODateTime(addMonths(new Date(), 1)) : null;

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
        ...(recurringStartDate ? { start_date: recurringStartDate } : {}),
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
        first_payment_already_captured: firstPaymentAlreadyCaptured,
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

    // Avisa o Mercado Pago para onde mandar os eventos desta recorrência —
    // ativação e cobrança mensal. É o que faz o assinante ficar em dia sozinho
    // sem depender de configuração no painel de cada barbearia.
    const notificationUrl = resolveNotificationUrl(backUrl);
    if (notificationUrl) payload.notification_url = notificationUrl;

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

    const preapprovalId = String(preapproval?.id || '').trim();
    const preapprovalStatus = String(preapproval?.status || '').toLowerCase().trim();
    const isRecurringActive =
      preapprovalStatus === 'authorized' ||
      preapprovalStatus === 'approved' ||
      preapprovalStatus === 'active' ||
      preapprovalStatus === 'paid';
    const recurringProvider: 'mercadopago_card_recurring' | 'mercadopago_card_recurring_pending' =
      isRecurringActive ? 'mercadopago_card_recurring' : 'mercadopago_card_recurring_pending';
    let pendingSubscriber: any = null;
    let boundExistingSubscription: any = null;

    if (existingClientSubscriptionId) {
      const { data: existingRow, error: existingRowError } = await supabaseAdmin
        .from('client_subscriptions')
        .select('id, payment_status')
        .eq('id', existingClientSubscriptionId)
        .eq('establishment_id', establishmentId)
        .maybeSingle();

      if (existingRowError || !existingRow?.id) {
        return json(404, {
          error: 'Assinante não encontrado para vincular recorrência',
          preapproval_id: preapprovalId,
        });
      }

      const currentStatus = String((existingRow as any)?.payment_status || '').toLowerCase();
      const updatePayload: any = {
        subscription_payment_provider: recurringProvider,
        subscription_payment_order_id: preapprovalId,
        // Cópia protegida do vínculo — ver comentário em upsertPendingClientSubscription.
        recurring_preapproval_id: preapprovalId,
        subscriber_payment_method: 'credito',
      };
      if (customerName) updatePayload.subscriber_name = customerName;
      if (customerEmail) updatePayload.subscriber_email = customerEmail;
      if (customerWhatsapp) updatePayload.subscriber_whatsapp = customerWhatsapp;
      if (currentStatus !== 'paid') {
        updatePayload.payment_status = 'unpaid';
      }

      let { data: updatedBound, error: updateBoundError } = await supabaseAdmin
        .from('client_subscriptions')
        .update(updatePayload)
        .eq('id', existingClientSubscriptionId)
        .eq('establishment_id', establishmentId)
        .select('id, payment_status, subscription_payment_provider, subscription_payment_order_id')
        .maybeSingle();

      if (updateBoundError && isMissingRecurringColumnError(updateBoundError)) {
        const legacyPayload = { ...updatePayload };
        delete legacyPayload.recurring_preapproval_id;
        ({ data: updatedBound, error: updateBoundError } = await supabaseAdmin
          .from('client_subscriptions')
          .update(legacyPayload)
          .eq('id', existingClientSubscriptionId)
          .eq('establishment_id', establishmentId)
          .select('id, payment_status, subscription_payment_provider, subscription_payment_order_id')
          .maybeSingle());
      }

      if (updateBoundError) {
        return json(500, {
          error: 'Recorrência criada no Mercado Pago, mas falhou ao vincular ao assinante existente',
          details: updateBoundError?.message || updateBoundError,
          preapproval_id: preapprovalId,
          subscription_status: String(preapproval?.status || 'pending'),
        });
      }
      boundExistingSubscription = updatedBound || null;
    } else if (cardTokenId) {
      try {
        pendingSubscriber = await upsertPendingClientSubscription({
          establishmentId,
          subscriptionId,
          preapprovalId,
          recurringProvider,
          customerName,
          customerWhatsapp,
          customerEmail,
          durationMonths: Number((subscriptionRow as any)?.duration_months || 1),
        });
      } catch (pendingError: any) {
        return json(500, {
          error: 'Recorrência criada no Mercado Pago, mas falhou ao criar o assinante como Não Pago no sistema',
          details: pendingError?.message || pendingError,
          preapproval_id: preapprovalId,
          subscription_status: String(preapproval?.status || 'pending'),
        });
      }
    }

    return json(200, {
      preapproval_id: preapprovalId,
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
      bound_existing_subscription_id: boundExistingSubscription?.id || null,
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
