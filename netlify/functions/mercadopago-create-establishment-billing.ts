import type { Handler } from '@netlify/functions';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { createMPPayment, CreateMPPaymentRequest } from '../../src/lib/mercadopago/mp-service';
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

    const tokenRaw = String(body?.token || '').trim();
    const pmIdRaw = String(body?.payment_method_id || '').trim();
    const isCard = Boolean(tokenRaw && pmIdRaw);
    const shouldCreateRecurringSubscription = isCard && body?.create_recurring_subscription === true;

    let paymentData: CreateMPPaymentRequest;

    if (isCard) {
      const payer = body?.payer || {};
      const idType = String(payer?.identification?.type || 'CPF').toUpperCase();
      const idNum = String(payer?.identification?.number || '').replace(/\D/g, '');
      const addr = payer?.address || {};
      if (!payer?.email || !idNum || !(idType === 'CPF' || idType === 'CNPJ')) {
        return json(400, { error: 'Para cartão: payer.email e payer.identification são obrigatórios' });
      }
      if (!addr?.zip_code || !addr?.street_name || addr?.street_number == null || !addr?.city || !addr?.federal_unit) {
        return json(400, { error: 'Para cartão: endereço de cobrança completo é obrigatório' });
      }
      paymentData = {
        amount: amountCents,
        description,
        access_token: PLATFORM_MP_ACCESS_TOKEN,
        payment_method_id: pmIdRaw,
        token: tokenRaw,
        issuer_id: String(body?.issuer_id || '').trim() || undefined,
        installments: Number(body?.installments) > 0 ? Number(body?.installments) : 1,
        payer: {
          email: String(payer.email).trim().toLowerCase(),
          first_name: String(payer.first_name || 'Cliente').trim(),
          last_name: String(payer.last_name || 'Cliente').trim(),
          identification: {
            type: idType === 'CNPJ' ? 'CNPJ' : 'CPF',
            number: idNum,
          },
          address: {
            zip_code: String(addr.zip_code).replace(/\D/g, ''),
            street_name: String(addr.street_name || '').trim(),
            street_number: Number(addr.street_number) || 0,
            neighborhood: String(addr.neighborhood || '').trim() || '—',
            city: String(addr.city || '').trim(),
            federal_unit: String(addr.federal_unit || '').trim().slice(0, 2).toUpperCase(),
          },
        },
        metadata,
      };
    } else {
      paymentData = {
        amount: amountCents,
        description,
        payer: { email: payerEmail },
        access_token: PLATFORM_MP_ACCESS_TOKEN,
        payment_method_id: 'pix',
        metadata,
      };
    }

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
          qr_code: isCard ? null : String(pixData?.qr_code || '') || null,
          qr_code_base64: isCard ? null : String(pixData?.qr_code_base64 || '') || null,
          metadata: { ...metadata, ...(isCard ? { payment_method: 'credit_card' } : {}) },
          paid_at: normalized === 'paid' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: 'payment_id' }
      );

    if (saveError) {
      console.error('❌ [MP Establishment Billing] Erro ao salvar cobranca:', saveError);
      return json(500, { error: 'Erro ao salvar cobranca', details: saveError.message });
    }

    let recurrenceCreated = false;
    let preapprovalId = '';
    if (isCard && normalized === 'paid' && shouldCreateRecurringSubscription) {
      const cardId = String((payment as any)?.card?.id || (payment as any)?.card_id || '').trim();
      if (cardId) {
        try {
          const backUrlCandidate = String(body?.backUrl || SUBSCRIPTION_BACK_URL || '').trim();
          const backUrl = /^https:\/\//i.test(backUrlCandidate) ? backUrlCandidate : undefined;
          const nextMonth = new Date();
          nextMonth.setMonth(nextMonth.getMonth() + 1);
          const preapprovalPayload: any = {
            reason: `Assinatura mensal Agendei Facil - ${String((establishment as any)?.name || 'Estabelecimento')}`,
            payer_email: String(paymentData.payer.email || payerEmail).trim().toLowerCase(),
            card_id: Number(cardId),
            external_reference: `establishment_billing_subscription:${establishmentId}`,
            auto_recurring: {
              frequency: 1,
              frequency_type: 'months',
              start_date: nextMonth.toISOString(),
              transaction_amount: amountCents / 100,
              currency_id: 'BRL',
            },
            status: 'authorized',
          };
          if (backUrl) preapprovalPayload.back_url = backUrl;

          const preapprovalResp = await axios.post(`${MP_API_BASE_URL}/preapproval`, preapprovalPayload, {
            headers: {
              Authorization: `Bearer ${PLATFORM_MP_ACCESS_TOKEN}`,
              'Content-Type': 'application/json',
              'X-Idempotency-Key': `est_bill_recur_${paymentId}`,
            },
          });
          const preapproval = preapprovalResp.data || {};
          preapprovalId = String(preapproval?.id || '').trim();
          recurrenceCreated = Boolean(preapprovalId);
          if (preapprovalId) {
            await supabaseAdmin
              .from('establishment_billing_subscriptions')
              .upsert(
                {
                  establishment_id: establishmentId,
                  preapproval_id: preapprovalId,
                  status: String(preapproval?.status || 'authorized'),
                  payer_email: String(paymentData.payer.email || payerEmail).trim().toLowerCase(),
                  amount_cents: amountCents,
                  description: `Assinatura mensal Agendei Facil - ${String((establishment as any)?.name || 'Estabelecimento')}`,
                  init_point: String(preapproval?.init_point || preapproval?.sandbox_init_point || '') || null,
                  payment_provider: 'mercadopago',
                  metadata: {
                    type: 'establishment_billing_subscription',
                    establishment_id: establishmentId,
                    first_payment_id: paymentId,
                    starts_after_first_paid_month: true,
                  },
                  updated_at: new Date().toISOString(),
                } as any,
                { onConflict: 'preapproval_id' }
              );
          }
        } catch (recurrenceError: any) {
          console.warn('⚠️ [MP Establishment Billing] Mensalidade atual paga, mas recorrência não foi criada:', recurrenceError?.response?.data || recurrenceError?.message);
        }
      }
    }

    if (isCard && normalized === 'paid' && shouldCreateRecurringSubscription && !recurrenceCreated) {
      return json(409, {
        ok: false,
        error: 'Mensalidade atual foi paga, mas a recorrência não foi criada no Mercado Pago. Não feche: chame o suporte para vincular a assinatura antes do próximo mês.',
        payment_id: paymentId,
        status: normalized,
        recurrence_created: false,
      });
    }

    return json(200, {
      ...payment,
      billing_type: 'establishment_billing',
      application_fee_cents_expected: 0,
      amount_cents_used: amountCents,
      amount_brl_used: amountCents / 100,
      recurrence_created: recurrenceCreated,
      preapproval_id: preapprovalId || null,
    });
  } catch (error: any) {
    console.error('❌ [MP Establishment Billing] Erro:', error);
    return json(500, {
      error: String(error?.message || 'Erro ao criar cobranca PIX'),
    });
  }
};
