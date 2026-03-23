import axios from 'axios';
import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { json, parseJsonBody } from './_utils';

const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const PLATFORM_MP_ACCESS_TOKEN = String(process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim();
const MP_API_BASE_URL = String(process.env.MERCADOPAGO_API_BASE_URL || 'https://api.mercadopago.com').trim();
const SUBSCRIPTION_BACK_URL = String(process.env.MERCADOPAGO_SUBSCRIPTION_BACK_URL || '').trim();

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
    if (!supabaseAdmin) return json(500, { error: 'Supabase admin nao configurado' });
    if (!PLATFORM_MP_ACCESS_TOKEN) return json(500, { error: 'MERCADOPAGO_ACCESS_TOKEN nao configurado' });

    const body = parseJsonBody<any>(event) || {};
    const establishmentId = String(body?.establishmentId || '').trim();
    const payerEmailRaw = String(body?.payer?.email || '').trim().toLowerCase();
    const descriptionRaw = String(body?.description || '').trim();
    const backUrlRaw = String(body?.backUrl || '').trim();

    if (!establishmentId) {
      return json(400, { error: 'Dados invalidos', required: ['establishmentId'] });
    }

    let establishment: any = null;
    let amountCents = 0;
    const { data: estWithAmount, error: estWithAmountError } = await supabaseAdmin
      .from('establishments')
      .select('id, name, mercadopago_billing_amount')
      .eq('id', establishmentId)
      .single();

    if (!estWithAmountError && estWithAmount) {
      establishment = estWithAmount;
      const estAmount = Number((estWithAmount as any)?.mercadopago_billing_amount ?? 0);
      amountCents = Math.round(estAmount * 100);
    } else {
      const { data: estFallback, error: estFallbackError } = await supabaseAdmin
        .from('establishments')
        .select('id, name')
        .eq('id', establishmentId)
        .single();
      if (estFallbackError || !estFallback) return json(404, { error: 'Estabelecimento nao encontrado' });
      establishment = estFallback;
    }

    if (amountCents <= 0) {
      const { data: adminConfig, error: adminError } = await supabaseAdmin
        .from('admin_billing_links')
        .select('mercadopago_billing_amount')
        .eq('id', 'global')
        .maybeSingle();
      if (!adminError) {
        const amountBRL = Number((adminConfig as any)?.mercadopago_billing_amount ?? 0);
        amountCents = Math.round(amountBRL * 100);
      }
    }

    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return json(400, {
        error: 'Valor cobranca MP nao configurado para este estabelecimento',
        userMessage: 'Configure o valor da cobrança PIX/cartão desta barbearia no Admin.',
      });
    }

    const payerEmail = payerEmailRaw || `billing_${establishmentId.slice(0, 8)}@agendeifacil.com`;
    const description = descriptionRaw || `Assinatura mensal Agendei Facil - ${String((establishment as any)?.name || 'Estabelecimento')}`;
    const backUrlCandidate = backUrlRaw || SUBSCRIPTION_BACK_URL;
    const backUrl = /^https:\/\//i.test(backUrlCandidate) ? backUrlCandidate : undefined;

    const preapprovalPayload: any = {
      reason: description,
      payer_email: payerEmail,
      external_reference: `establishment_billing_subscription:${establishmentId}`,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: amountCents / 100,
        currency_id: 'BRL',
      },
      status: 'pending',
    };
    if (!backUrl) {
      return json(400, {
        error: 'back_url is required',
        userMessage: 'Configure MERCADOPAGO_SUBSCRIPTION_BACK_URL com uma URL HTTPS pública (ex.: https://app.agendeifacil.com/dashboard/establishment).',
      });
    }
    preapprovalPayload.back_url = backUrl;

    const response = await axios.post(`${MP_API_BASE_URL}/preapproval`, preapprovalPayload, {
      headers: {
        Authorization: `Bearer ${PLATFORM_MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `sub_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      },
    });

    const preapproval = response.data || {};
    const preapprovalId = String(preapproval?.id || '').trim();
    if (!preapprovalId) return json(500, { error: 'Assinatura criada sem ID no Mercado Pago' });

    const nowIso = new Date().toISOString();
    const { error: saveError } = await supabaseAdmin
      .from('establishment_billing_subscriptions')
      .upsert(
        {
          establishment_id: establishmentId,
          preapproval_id: preapprovalId,
          status: String(preapproval?.status || 'pending'),
          payer_email: payerEmail,
          amount_cents: amountCents,
          description,
          init_point: String(preapproval?.init_point || preapproval?.sandbox_init_point || '') || null,
          payment_provider: 'mercadopago',
          metadata: {
            type: 'establishment_billing_subscription',
            establishment_id: establishmentId,
          },
          updated_at: nowIso,
        } as any,
        { onConflict: 'preapproval_id' }
      );

    if (saveError) {
      const msg = String((saveError as any)?.message || '').toLowerCase();
      const missingTable = msg.includes('relation') || msg.includes('does not exist') || msg.includes('establishment_billing_subscriptions');
      if (!missingTable) {
        return json(500, { error: 'Erro ao salvar assinatura', details: saveError.message });
      }
    }

    return json(200, {
      subscription_type: 'establishment_billing_recurring_card',
      preapproval_id: preapprovalId,
      status: String(preapproval?.status || 'pending'),
      init_point: preapproval?.init_point || null,
      sandbox_init_point: preapproval?.sandbox_init_point || null,
      amount_cents_used: amountCents,
      amount_brl_used: amountCents / 100,
    });
  } catch (error: any) {
    const message =
      String(error?.response?.data?.message || '') ||
      String(error?.response?.data?.error || '') ||
      String(error?.message || 'Erro ao criar assinatura recorrente no cartão');
    return json(500, { error: message });
  }
};

