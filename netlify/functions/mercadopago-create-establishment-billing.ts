import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { createMPPayment, CreateMPPaymentRequest } from '../../src/lib/mercadopago/mp-service';
import { json, parseJsonBody } from './_utils';

const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const PLATFORM_MP_ACCESS_TOKEN = String(process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim();

const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    : null;

const normalizeStatus = (raw: unknown): 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded' => {
  const status = String(raw || '').toLowerCase().trim();
  if (status === 'approved' || status === 'authorized') return 'paid';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'refunded') return 'refunded';
  if (status === 'rejected') return 'failed';
  return 'pending';
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' }, { Allow: 'POST' });
  }

  try {
    if (!supabaseAdmin) {
      return json(500, { error: 'Supabase admin nao configurado' });
    }
    if (!PLATFORM_MP_ACCESS_TOKEN) {
      return json(500, { error: 'MERCADOPAGO_ACCESS_TOKEN nao configurado' });
    }

    const body = parseJsonBody<any>(event) || {};
    const establishmentId = String(body?.establishmentId || '').trim();
    const payerEmailRaw = String(body?.payer?.email || '').trim().toLowerCase();
    const descriptionRaw = String(body?.description || '').trim();

    if (!establishmentId) {
      return json(400, {
        error: 'Dados invalidos',
        required: ['establishmentId'],
      });
    }

    // Preferência: valor por estabelecimento (coluna nova). Fallback seguro para global antigo.
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
      const errMsg = String((estWithAmountError as any)?.message || '').toLowerCase();
      const missingColumn = errMsg.includes('mercadopago_billing_amount') || errMsg.includes('column');

      const { data: estFallback, error: estFallbackError } = await supabaseAdmin
        .from('establishments')
        .select('id, name')
        .eq('id', establishmentId)
        .single();

      if (estFallbackError || !estFallback) {
        return json(404, { error: 'Estabelecimento nao encontrado' });
      }

      establishment = estFallback;
      if (!missingColumn) {
        console.warn('⚠️ [MP Establishment Billing] Falha ao ler mercadopago_billing_amount; usando fallback global.', estWithAmountError);
      }
    }

    if (amountCents <= 0) {
      const { data: adminConfig, error: adminConfigError } = await supabaseAdmin
        .from('admin_billing_links')
        .select('mercadopago_billing_amount')
        .eq('id', 'global')
        .maybeSingle();

      if (!adminConfigError) {
        const amountBRL = Number((adminConfig as any)?.mercadopago_billing_amount ?? 0);
        amountCents = Math.round(amountBRL * 100);
      }
    }

    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return json(400, {
        error: 'Valor cobranca MP nao configurado para este estabelecimento',
        userMessage: 'Configure o valor de cobrança PIX desta barbearia no Admin.',
      });
    }

    const payerEmail = payerEmailRaw || `billing_${establishmentId.slice(0, 8)}@agendeifacil.com`;
    const description = descriptionRaw || `Regularizacao Agendei Facil - ${String((establishment as any)?.name || 'Estabelecimento')}`;

    const metadata = {
      type: 'establishment_billing',
      establishment_id: establishmentId,
      source: 'establishment_dashboard',
      created_at: new Date().toISOString(),
    };

    const paymentData: CreateMPPaymentRequest = {
      amount: amountCents,
      description,
      payer: { email: payerEmail },
      access_token: PLATFORM_MP_ACCESS_TOKEN,
      payment_method_id: 'pix',
      metadata,
    };

    const payment = await createMPPayment(paymentData);
    const paymentId = String((payment as any)?.id || '').trim();
    if (!paymentId) {
      return json(500, { error: 'Pagamento criado sem ID' });
    }

    const normalized = normalizeStatus((payment as any)?.status);
    const pixData = (payment as any)?.point_of_interaction?.transaction_data || {};

    const { error: saveError } = await supabaseAdmin
      .from('establishment_billing_payments')
      .upsert(
        {
          establishment_id: establishmentId,
          amount_cents: amountCents,
          payment_provider: 'mercadopago',
          payment_id: paymentId,
          status: normalized,
          description,
          qr_code: String(pixData?.qr_code || '') || null,
          qr_code_base64: String(pixData?.qr_code_base64 || '') || null,
          metadata,
          paid_at: normalized === 'paid' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: 'payment_id' }
      );

    if (saveError) {
      console.error('❌ [MP Establishment Billing] Erro ao salvar cobranca:', saveError);
      return json(500, { error: 'Erro ao salvar cobranca', details: saveError.message });
    }

    return json(200, {
      ...payment,
      billing_type: 'establishment_billing',
      application_fee_cents_expected: 0,
      amount_cents_used: amountCents,
      amount_brl_used: amountCents / 100,
    });
  } catch (error: any) {
    console.error('❌ [MP Establishment Billing] Erro:', error);
    return json(500, {
      error: String(error?.message || 'Erro ao criar cobranca PIX'),
    });
  }
};
