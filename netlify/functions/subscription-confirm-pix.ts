import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { refreshAccessToken } from '../../src/lib/mercadopago/mp-oauth';
import { checkPaymentStatus } from '../../src/lib/pagarme-server';

const onlyDigits = (v: string) => String(v || '').replace(/\D/g, '');
const toISODate = (d: Date) => d.toISOString().slice(0, 10);
const addMonths = (date: Date, months: number) => {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d;
};

const getSubscriberPaymentMethodFromProvider = (providerRaw: unknown): string | null => {
  const provider = String(providerRaw || '').toLowerCase().trim();
  if (!provider) return null;
  if (provider.includes('pix')) return 'pix';
  if (provider.includes('debit') || provider.includes('debito')) return 'debito';
  if (provider.includes('credit') || provider.includes('card') || provider.includes('credito')) return 'credito';
  if (provider.includes('dinheiro')) return 'dinheiro';
  return null;
};

const findExistingSubscriberByPhone = async (
  supabaseAdmin: any,
  establishmentId: string,
  subscriptionId: string,
  customerWhatsapp: string
) => {
  const estId = String(establishmentId || '').trim();
  const subId = String(subscriptionId || '').trim();
  const phone = String(customerWhatsapp || '').trim();
  if (!estId || !subId || !phone) return { data: null, error: null };

  const attempts: Array<{ column: 'subscriber_whatsapp' | 'client_whatsapp'; sameSubscriptionFirst: boolean }> = [
    { column: 'subscriber_whatsapp', sameSubscriptionFirst: true },
    { column: 'subscriber_whatsapp', sameSubscriptionFirst: false },
    { column: 'client_whatsapp', sameSubscriptionFirst: true },
    { column: 'client_whatsapp', sameSubscriptionFirst: false },
  ];

  let lastError: any = null;

  for (const attempt of attempts) {
    let query = supabaseAdmin
      .from('client_subscriptions')
      .select('id, subscription_id, created_at')
      .eq('establishment_id', estId)
      // @ts-expect-error colunas legadas podem não existir no tipo
      .eq(attempt.column, phone)
      .order('created_at', { ascending: false })
      .limit(1);

    if (attempt.sameSubscriptionFirst) {
      query = query.eq('subscription_id', subId);
    }

    const { data, error } = await query.maybeSingle();
    if (!error && data?.id) {
      return { data, error: null };
    }
    if (error) {
      lastError = error;
    }
  }

  return { data: null, error: lastError };
};

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
    const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Supabase admin não configurado',
          details: { hasUrl: Boolean(SUPABASE_URL), hasServiceRole: Boolean(SUPABASE_SERVICE_ROLE_KEY) },
        }),
      };
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = event.body ? JSON.parse(event.body) : {};
    const { orderId, establishmentId, subscriptionId, customer, provider } = body || {};

    const customerName = String(customer?.name || '').trim();
    const customerWhatsapp = onlyDigits(String(customer?.whatsapp || customer?.phone || ''));
    const customerEmail = String(customer?.email || '').trim() || null;

    if (!orderId || !establishmentId || !subscriptionId || !customerName || !customerWhatsapp) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Dados incompletos',
          required: ['orderId', 'establishmentId', 'subscriptionId', 'customer.name', 'customer.whatsapp'],
        }),
      };
    }

    // Validar pagamento (Pagar.me ou Mercado Pago)
    const providerNormalized = String(provider || 'pagarme_pix').toLowerCase().trim();
    let normalizedStatus: string;

    if (providerNormalized.startsWith('mercadopago_')) {
      // Validar pagamento Mercado Pago
      const { checkMPPaymentStatus } = await import('../../src/lib/mercadopago/mp-service');

      // Buscar access_token do estabelecimento
      const { data: establishment, error: fetchError } = await supabaseAdmin
        .from('establishments')
        .select('mercadopago_access_token, mercadopago_refresh_token, mercadopago_token_expires_at')
        .eq('id', String(establishmentId))
        .single();

      if (fetchError || !establishment) {
        return { statusCode: 404, body: JSON.stringify({ error: 'Estabelecimento não encontrado' }) };
      }

      const accessTokenRaw = String((establishment as any)?.mercadopago_access_token || '').trim();
      const refreshTokenRaw = String((establishment as any)?.mercadopago_refresh_token || '').trim();
      const expiresAtRaw = (establishment as any)?.mercadopago_token_expires_at as string | null | undefined;

      if (!accessTokenRaw) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Estabelecimento não possui conta do Mercado Pago conectada' }) };
      }

      // ✅ Auto-refresh do token se estiver expirado (evita "parou do nada" após ~6h)
      let accessToken = accessTokenRaw;
      if (expiresAtRaw) {
        const expiresAt = new Date(expiresAtRaw);
        const now = Date.now();
        const safetyMs = 2 * 60 * 1000;
        const isExpired = !Number.isFinite(expiresAt.getTime()) ? false : expiresAt.getTime() <= now + safetyMs;
        if (isExpired) {
          if (!refreshTokenRaw) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Mercado Pago expirado e sem refresh_token. Reconecte o Mercado Pago.' }) };
          }
          const refreshed = await refreshAccessToken(refreshTokenRaw);
          const newAccessToken = String(refreshed.access_token || '').trim();
          const newRefreshToken = String(refreshed.refresh_token || refreshTokenRaw).trim();
          const expiresIn = Number(refreshed.expires_in || 21600);
          const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

          if (newAccessToken) {
            accessToken = newAccessToken;
            await supabaseAdmin
              .from('establishments')
              .update({
                mercadopago_access_token: newAccessToken,
                mercadopago_refresh_token: newRefreshToken,
                mercadopago_token_expires_at: newExpiresAt,
              } as any)
              .eq('id', String(establishmentId));
          }
        }
      }

      const paymentId = Number(orderId);
      if (Number.isFinite(paymentId) && paymentId > 0) {
        const statusResult = await checkMPPaymentStatus(paymentId, String(accessToken));
        normalizedStatus = String(statusResult.status || '').toLowerCase();

        if (normalizedStatus !== 'approved' && normalizedStatus !== 'authorized') {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Pagamento ainda não confirmado', details: { status: normalizedStatus } }),
          };
        }
      } else {
        // Recorrência real (preapproval): orderId é preapproval_id
        const MP_API_BASE_URL = String(process.env.MERCADOPAGO_API_BASE_URL || 'https://api.mercadopago.com').trim();
        const preapprovalResp = await axios.get(
          `${MP_API_BASE_URL}/preapproval/${encodeURIComponent(String(orderId))}`,
          {
            headers: {
              Authorization: `Bearer ${String(accessToken)}`,
              'Content-Type': 'application/json',
            },
          }
        );
        normalizedStatus = String((preapprovalResp.data as any)?.status || '').toLowerCase();
        if (normalizedStatus !== 'authorized') {
          return {
            statusCode: 400,
            body: JSON.stringify({
              error: 'Assinatura recorrente ainda não autorizada',
              details: { status: normalizedStatus },
            }),
          };
        }
      }
    } else {
      // Validar pagamento Pagar.me
      const statusResult = await checkPaymentStatus(String(orderId));
      normalizedStatus = String((statusResult as any)?.status || '').toLowerCase();

      if (normalizedStatus !== 'paid' && normalizedStatus !== 'authorized') {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Pagamento ainda não confirmado', details: { status: normalizedStatus } }),
        };
      }
    }

    const { data: subData, error: subErr } = await supabaseAdmin
      .from('subscriptions')
      .select('duration_months')
      .eq('id', String(subscriptionId))
      .single();
    if (subErr) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Erro ao buscar assinatura', details: subErr }) };
    }

    const durationMonths = Number((subData as any)?.duration_months || 1);
    const today = new Date();
    const startDate = toISODate(today);
    const endDate = toISODate(addMonths(today, Number.isFinite(durationMonths) && durationMonths > 0 ? durationMonths : 1));

    const { data: existing, error: existingErr } = await findExistingSubscriberByPhone(
      supabaseAdmin,
      String(establishmentId),
      String(subscriptionId),
      customerWhatsapp
    );
    if (existingErr) {
      console.warn('⚠️ Não foi possível checar assinatura existente (confirm):', existingErr);
    }

    // Reutilizar providerNormalized já declarado acima (linha 56)
    const providerFinal =
      providerNormalized === 'pagarme_card' || providerNormalized === 'pagarme_pix' ||
        providerNormalized === 'mercadopago_card' || providerNormalized === 'mercadopago_pix'
        ? providerNormalized
        : 'pagarme_pix';
    const subscriberPaymentMethod = getSubscriberPaymentMethodFromProvider(providerFinal);

    const payload: any = {
      subscription_id: String(subscriptionId),
      establishment_id: String(establishmentId),
      start_date: startDate,
      end_date: endDate,
      payment_status: 'paid',
      last_payment_date: startDate,
      subscriber_name: customerName,
      subscriber_whatsapp: customerWhatsapp,
      subscriber_email: customerEmail,
      subscriber_payment_method: subscriberPaymentMethod,
      subscription_payment_provider: providerFinal,
      subscription_payment_order_id: String(orderId),
    };

    let resultRow: any = null;
    if (existing?.id) {
      const { data: upd, error: updErr } = await supabaseAdmin
        .from('client_subscriptions')
        .update(payload)
        .eq('id', String(existing.id))
        .select()
        .single();
      if (updErr) return { statusCode: 500, body: JSON.stringify({ error: 'Erro ao atualizar assinatura', details: updErr }) };
      resultRow = upd;
    } else {
      const { data: ins, error: insErr } = await supabaseAdmin
        .from('client_subscriptions')
        .insert([{ client_id: uuidv4(), ...payload }])
        .select()
        .single();
      if (insErr) return { statusCode: 500, body: JSON.stringify({ error: 'Erro ao criar assinatura', details: insErr }) };
      resultRow = ins;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, status: normalizedStatus, subscription: resultRow }),
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error?.message || 'Erro ao confirmar assinatura via PIX',
        details: error?.details || error?.hint || error?.code || undefined,
      }),
    };
  }
};


