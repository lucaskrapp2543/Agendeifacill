/**
 * Mercado Pago Routes - Rotas OAuth e pagamentos
 * 
 * Define as rotas para OAuth e criação de pagamentos do Mercado Pago
 */

import { createClient } from '@supabase/supabase-js';
import { Request, Response, Router } from 'express';
import axios from 'axios';
// Importar de src/lib para compatibilidade (também funciona em server local)
import { exchangeCodeForToken, getAuthorizationUrl } from '../../src/lib/mercadopago/mp-oauth';
import { confirmPendingAppointmentFromMpPaymentMetadata } from '../../src/lib/mercadopago/confirmAppointmentFromMpPayment';
import { reconcilePendingMercadoPagoAppointments } from '../../src/lib/mercadopago/reconcilePendingAppointmentsMp';
import { checkMPPaymentStatus, createMPPayment, CreateMPPaymentRequest } from '../../src/lib/mercadopago/mp-service';

const router = Router();

// Função para obter Supabase Admin (carrega variáveis dinamicamente)
function getSupabaseAdmin() {
  const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('⚠️ [MP Routes] Supabase admin não configurado:', {
      hasUrl: !!SUPABASE_URL,
      hasKey: !!SUPABASE_SERVICE_ROLE_KEY,
    });
    return null;
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const normalizeSubscriptionPaymentStatus = (raw: unknown): 'paid' | 'pending' | 'failed' | 'cancelled' => {
  const status = String(raw || '').toLowerCase().trim();
  if (status === 'approved' || status === 'authorized' || status === 'paid') return 'paid';
  if (status === 'cancelled' || status === 'canceled') return 'cancelled';
  if (status === 'rejected' || status === 'refused' || status === 'failed') return 'failed';
  return 'pending';
};

const toISODate = (d: Date): string => d.toISOString().slice(0, 10);
const addMonths = (date: Date, months: number): Date => {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d;
};

/**
 * GET /api/mercadopago/oauth/authorize
 * Inicia o fluxo OAuth do Mercado Pago
 * 
 * Query params:
 * - establishmentId: ID do estabelecimento
 */
router.get('/oauth/authorize', async (req: Request, res: Response) => {
  try {
    const establishmentId = req.query.establishmentId as string;

    if (!establishmentId) {
      return res.status(400).json({
        error: 'establishmentId é obrigatório',
      });
    }

    // Verificar se o estabelecimento existe
    const supabaseAdmin = getSupabaseAdmin();
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('establishments')
        .select('id')
        .eq('id', establishmentId)
        .single();

      if (error || !data) {
        return res.status(404).json({
          error: 'Estabelecimento não encontrado',
        });
      }
    }

    // Gerar URL de autorização
    const authUrl = getAuthorizationUrl(establishmentId);

    return res.status(200).json({
      authorization_url: authUrl,
      establishment_id: establishmentId,
    });
  } catch (error: any) {
    console.error('❌ [MP Routes] Erro ao gerar URL de autorização:', error);
    return res.status(500).json({
      error: error.message || 'Erro ao gerar URL de autorização',
    });
  }
});

/**
 * GET /api/mercadopago/oauth/callback
 * Callback OAuth do Mercado Pago
 * 
 * Query params:
 * - code: Código de autorização
 * - state: establishmentId (passado no início do fluxo)
 */
router.get('/oauth/callback', async (req: Request, res: Response) => {
  try {
    const code = req.query.code as string;
    const state = req.query.state as string; // establishmentId

    if (!code) {
      return res.status(400).json({
        error: 'Código de autorização não fornecido',
      });
    }

    if (!state) {
      return res.status(400).json({
        error: 'State (establishmentId) não fornecido',
      });
    }

    const establishmentId = state;

    console.log('🔄 [MP Routes] Processando callback OAuth:', {
      establishmentId,
      hasCode: !!code,
    });

    // Trocar código por token
    const tokenData = await exchangeCodeForToken(code);

    // Salvar tokens no banco de dados
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return res.status(500).json({
        error: 'Supabase admin não configurado',
      });
    }

    const { error: updateError } = await supabaseAdmin
      .from('establishments')
      .update({
        mercadopago_user_id: String(tokenData.user_id),
        mercadopago_access_token: tokenData.access_token,
        mercadopago_refresh_token: tokenData.refresh_token,
        mercadopago_token_expires_at: new Date(
          Date.now() + tokenData.expires_in * 1000
        ).toISOString(),
      })
      .eq('id', establishmentId);

    if (updateError) {
      console.error('❌ [MP Routes] Erro ao salvar tokens:', updateError);
      return res.status(500).json({
        error: 'Erro ao salvar tokens no banco de dados',
        details: updateError,
      });
    }

    console.log('✅ [MP Routes] Tokens salvos com sucesso:', {
      establishmentId,
      user_id: tokenData.user_id,
    });

    // Retornar sucesso (em produção, redirecionar para uma página de sucesso)
    return res.status(200).json({
      success: true,
      message: 'Conta do Mercado Pago conectada com sucesso',
      user_id: tokenData.user_id,
      establishment_id: establishmentId,
    });
  } catch (error: any) {
    console.error('❌ [MP Routes] Erro no callback OAuth:', error);
    return res.status(500).json({
      error: error.message || 'Erro ao processar callback OAuth',
    });
  }
});

/**
 * POST /api/mercadopago/create-payment
 * Cria um pagamento no Mercado Pago Marketplace
 * 
 * Body:
 * - establishmentId: ID do estabelecimento
 * - amount: Valor em centavos
 * - description: Descrição do pagamento
 * - payer: { email, identification?: { type, number } }
 * - payment_method_id: 'pix', 'credit_card', etc.
 * - metadata?: Dados adicionais
 */
router.post('/create-payment', async (req: Request, res: Response) => {
  try {
    const {
      establishmentId,
      amount,
      description,
      payer,
      payment_method_id,
      installments,
      token,
      metadata,
    } = req.body;

    // Validação
    if (!establishmentId || !amount || !description || !payer?.email) {
      return res.status(400).json({
        error: 'Dados incompletos',
        required: ['establishmentId', 'amount', 'description', 'payer.email'],
      });
    }

    // Buscar access_token do estabelecimento
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return res.status(500).json({
        error: 'Supabase admin não configurado',
      });
    }

    const { data: establishment, error: fetchError } = await supabaseAdmin
      .from('establishments')
      .select('id, mercadopago_access_token, mercadopago_user_id')
      .eq('id', establishmentId)
      .single();

    if (fetchError || !establishment) {
      return res.status(404).json({
        error: 'Estabelecimento não encontrado',
      });
    }

    const accessToken = (establishment as any)?.mercadopago_access_token;

    if (!accessToken) {
      return res.status(400).json({
        error: 'Estabelecimento não possui conta do Mercado Pago conectada',
        userMessage: 'Conecte a conta do Mercado Pago antes de criar pagamentos',
      });
    }

    // Taxa da plataforma (centavos) para Mercado Pago.
    // Regras:
    // - Cartão: prioriza MERCADOPAGO_CREDIT_PLATFORM_FEE_CENTS (fallback 100 = R$1,00)
    // - PIX: mantém MERCADOPAGO_PLATFORM_FEE_CENTS / PLATFORM_FEE_CENTS (fallback 50 = R$0,50)
    const normalizedMethod = String(payment_method_id || '').toLowerCase().trim();
    const isCardPayment = Boolean(token) || (normalizedMethod !== '' && normalizedMethod !== 'pix');
    const applicationFeeRaw = isCardPayment
      ? (
        process.env.MERCADOPAGO_CREDIT_PLATFORM_FEE_CENTS ||
        process.env.PLATFORM_CREDIT_FEE_CENTS ||
        '100'
      )
      : (
        process.env.MERCADOPAGO_PLATFORM_FEE_CENTS ||
        process.env.PLATFORM_FEE_CENTS ||
        '50'
      );
    const applicationFee = Number(String(applicationFeeRaw).trim());

    // Criar pagamento
    const paymentData: CreateMPPaymentRequest = {
      amount: Math.round(Number(amount)),
      description: String(description),
      payer: {
        email: String(payer.email),
        ...(payer.identification
          ? {
            identification: {
              type: payer.identification.type === 'CPF' ? 'CPF' : 'CNPJ',
              number: String(payer.identification.number),
            },
          }
          : {}),
        ...(payer.address ? { address: payer.address } : {}),
      },
      application_fee: applicationFee,
      access_token: String(accessToken),
      payment_method_id: payment_method_id || 'pix',
      ...(installments ? { installments: Number(installments) } : {}),
      ...(token ? { token: String(token) } : {}),
      ...(metadata ? { metadata } : {}),
    };

    const payment = await createMPPayment(paymentData);

    const returnedFee = Number((payment as any)?.application_fee ?? 0);
    const expectedFee = Number((paymentData.application_fee || 0) / 100);
    const feeIsValid = Number.isFinite(returnedFee) && Math.abs(returnedFee - expectedFee) < 0.0001;
    if (!feeIsValid) {
      console.warn('⚠️ [MP Routes] Taxa divergente detectada (sem bloquear pagamento):', {
        establishmentId,
        paymentId: (payment as any)?.id,
        expectedFee,
        returnedFee,
      });
    }

    console.log('✅ [MP Routes] Pagamento criado:', {
      paymentId: payment.id,
      status: payment.status,
      establishmentId,
    });

    return res.status(200).json({
      ...payment,
      fee_expected: expectedFee,
      fee_returned: returnedFee,
      fee_validation: feeIsValid ? 'ok' : 'divergent',
      fee_version: `R$${(applicationFee / 100).toFixed(2).replace('.', ',')}`,
      application_fee_cents_expected: applicationFee,
      fee_mode: isCardPayment ? 'credit_card' : 'pix',
    });
  } catch (error: any) {
    console.error('❌ [MP Routes] Erro ao criar pagamento:', error);
    return res.status(500).json({
      error: error.message || 'Erro ao criar pagamento',
    });
  }
});

/**
 * POST /api/mercadopago/create-establishment-billing
 * Cria PIX de regularizacao da barbearia (100% para a plataforma, sem split).
 */
router.post('/create-establishment-billing', async (req: Request, res: Response) => {
  try {
    const { establishmentId, description, payer } = req.body || {};
    if (!establishmentId) {
      return res.status(400).json({
        error: 'establishmentId é obrigatório',
      });
    }

    const platformAccessToken = String(process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim();
    if (!platformAccessToken) {
      return res.status(500).json({
        error: 'MERCADOPAGO_ACCESS_TOKEN não configurado',
      });
    }

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return res.status(500).json({
        error: 'Supabase admin não configurado',
      });
    }

    let establishment: any = null;
    let amountCents = 0;

    const { data: estWithAmount, error: estWithAmountError } = await supabaseAdmin
      .from('establishments')
      .select('id, name, mercadopago_billing_amount')
      .eq('id', String(establishmentId))
      .single();

    if (!estWithAmountError && estWithAmount) {
      establishment = estWithAmount;
      const estAmount = Number((estWithAmount as any)?.mercadopago_billing_amount ?? 0);
      amountCents = Math.round(estAmount * 100);
    } else {
      const { data: estFallback, error: estFallbackError } = await supabaseAdmin
        .from('establishments')
        .select('id, name')
        .eq('id', String(establishmentId))
        .single();

      if (estFallbackError || !estFallback) {
        return res.status(404).json({
          error: 'Estabelecimento não encontrado',
        });
      }
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
      return res.status(400).json({
        error: 'Valor cobrança MP não configurado para este estabelecimento',
        userMessage: 'Configure o valor da cobrança PIX desta barbearia no Admin.',
      });
    }

    const payerEmail = String(payer?.email || `billing_${String(establishmentId).slice(0, 8)}@agendeifacil.com`).trim();
    const billingDescription = String(
      description || `Regularizacao Agendei Facil - ${String((establishment as any)?.name || 'Estabelecimento')}`
    );

    const body = req.body || {};
    const tokenRaw = String(body?.token || '').trim();
    const pmIdRaw = String(body?.payment_method_id || '').trim();
    const isCard = Boolean(tokenRaw && pmIdRaw);

    const metadataBase = {
      type: 'establishment_billing',
      establishment_id: String(establishmentId),
      source: 'establishment_dashboard',
      created_at: new Date().toISOString(),
    };

    let payment: Awaited<ReturnType<typeof createMPPayment>>;
    if (isCard) {
      const payerCard = body?.payer || {};
      const idType = String(payerCard?.identification?.type || 'CPF').toUpperCase();
      const idNum = String(payerCard?.identification?.number || '').replace(/\D/g, '');
      const addr = payerCard?.address || {};
      if (!payerCard?.email || !idNum || !(idType === 'CPF' || idType === 'CNPJ')) {
        return res.status(400).json({ error: 'Para cartão: payer.email e payer.identification são obrigatórios' });
      }
      if (!addr?.zip_code || !addr?.street_name || addr?.street_number == null || !addr?.city || !addr?.federal_unit) {
        return res.status(400).json({ error: 'Para cartão: endereço de cobrança completo é obrigatório' });
      }
      payment = await createMPPayment({
        amount: amountCents,
        description: billingDescription,
        access_token: platformAccessToken,
        payment_method_id: pmIdRaw,
        token: tokenRaw,
        issuer_id: String(body?.issuer_id || '').trim() || undefined,
        installments: Number(body?.installments) > 0 ? Number(body?.installments) : 1,
        payer: {
          email: String(payerCard.email).trim().toLowerCase(),
          first_name: String(payerCard.first_name || 'Cliente').trim(),
          last_name: String(payerCard.last_name || 'Cliente').trim(),
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
        metadata: metadataBase,
      });
    } else {
      payment = await createMPPayment({
        amount: amountCents,
        description: billingDescription,
        payer: { email: payerEmail },
        access_token: platformAccessToken,
        payment_method_id: 'pix',
        metadata: metadataBase,
      });
    }

    const normalizedStatus = (() => {
      const raw = String((payment as any)?.status || '').toLowerCase().trim();
      if (raw === 'approved' || raw === 'authorized') return 'paid';
      if (raw === 'cancelled') return 'cancelled';
      if (raw === 'rejected') return 'failed';
      if (raw === 'refunded') return 'refunded';
      return 'pending';
    })();

    const pixData = (payment as any)?.point_of_interaction?.transaction_data || {};
    const { error: saveError } = await supabaseAdmin
      .from('establishment_billing_payments')
      .upsert(
        {
          establishment_id: String(establishmentId),
          amount_cents: amountCents,
          payment_provider: 'mercadopago',
          payment_id: String((payment as any)?.id || ''),
          status: normalizedStatus,
          description: billingDescription,
          qr_code: isCard ? null : String(pixData?.qr_code || '') || null,
          qr_code_base64: isCard ? null : String(pixData?.qr_code_base64 || '') || null,
          metadata: {
            type: 'establishment_billing',
            establishment_id: String(establishmentId),
            ...(isCard ? { payment_method: 'credit_card' } : {}),
          },
          paid_at: normalizedStatus === 'paid' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: 'payment_id' }
      );

    if (saveError) {
      return res.status(500).json({
        error: 'Erro ao salvar cobrança',
        details: saveError,
      });
    }

    return res.status(200).json({
      ...payment,
      billing_type: 'establishment_billing',
      application_fee_cents_expected: 0,
      amount_cents_used: amountCents,
      amount_brl_used: amountCents / 100,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error?.message || 'Erro ao criar cobrança PIX de regularização',
    });
  }
});

/**
 * POST /api/mercadopago/create-establishment-billing-subscription
 * Cria assinatura recorrente mensal no cartão para regularização da barbearia.
 */
router.post('/create-establishment-billing-subscription', async (req: Request, res: Response) => {
  try {
    const { establishmentId, description, payer, backUrl } = req.body || {};
    if (!establishmentId) {
      return res.status(400).json({ error: 'establishmentId é obrigatório' });
    }

    const platformAccessToken = String(process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim();
    const MP_API_BASE_URL = String(process.env.MERCADOPAGO_API_BASE_URL || 'https://api.mercadopago.com').trim();
    const SUBSCRIPTION_BACK_URL = String(process.env.MERCADOPAGO_SUBSCRIPTION_BACK_URL || '').trim();
    if (!platformAccessToken) {
      return res.status(500).json({ error: 'MERCADOPAGO_ACCESS_TOKEN não configurado' });
    }

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Supabase admin não configurado' });
    }

    let establishment: any = null;
    let amountCents = 0;
    const { data: estWithAmount, error: estWithAmountError } = await supabaseAdmin
      .from('establishments')
      .select('id, name, mercadopago_billing_amount')
      .eq('id', String(establishmentId))
      .single();

    if (!estWithAmountError && estWithAmount) {
      establishment = estWithAmount;
      const estAmount = Number((estWithAmount as any)?.mercadopago_billing_amount ?? 0);
      amountCents = Math.round(estAmount * 100);
    } else {
      const { data: estFallback, error: estFallbackError } = await supabaseAdmin
        .from('establishments')
        .select('id, name')
        .eq('id', String(establishmentId))
        .single();

      if (estFallbackError || !estFallback) {
        return res.status(404).json({ error: 'Estabelecimento não encontrado' });
      }
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
      return res.status(400).json({
        error: 'Valor cobrança MP não configurado para este estabelecimento',
        userMessage: 'Configure o valor da cobrança PIX/cartão desta barbearia no Admin.',
      });
    }

    const payerEmail = String(payer?.email || `billing_${String(establishmentId).slice(0, 8)}@agendeifacil.com`).trim().toLowerCase();
    const recurringDescription = String(
      description || `Assinatura mensal Agendei Facil - ${String((establishment as any)?.name || 'Estabelecimento')}`
    );

    const preapprovalPayload: any = {
      reason: recurringDescription,
      payer_email: payerEmail,
      external_reference: `establishment_billing_subscription:${String(establishmentId)}`,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: amountCents / 100,
        currency_id: 'BRL',
      },
      status: 'pending',
    };
    const backUrlCandidate = String(backUrl || SUBSCRIPTION_BACK_URL || '').trim();
    if (!/^https:\/\//i.test(backUrlCandidate)) {
      return res.status(400).json({
        error: 'back_url is required',
        userMessage: 'Configure MERCADOPAGO_SUBSCRIPTION_BACK_URL com uma URL HTTPS pública (ex.: https://app.agendeifacil.com/dashboard/establishment).',
      });
    }
    preapprovalPayload.back_url = backUrlCandidate;

    const mpResponse = await axios.post(`${MP_API_BASE_URL}/preapproval`, preapprovalPayload, {
      headers: {
        Authorization: `Bearer ${platformAccessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `sub_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      },
    });

    const preapproval = mpResponse.data || {};
    const preapprovalId = String(preapproval?.id || '').trim();
    if (!preapprovalId) {
      return res.status(500).json({ error: 'Assinatura criada sem ID no Mercado Pago' });
    }

    const nowIso = new Date().toISOString();
    const { error: saveError } = await supabaseAdmin
      .from('establishment_billing_subscriptions')
      .upsert(
        {
          establishment_id: String(establishmentId),
          preapproval_id: preapprovalId,
          status: String(preapproval?.status || 'pending'),
          payer_email: payerEmail,
          amount_cents: amountCents,
          description: recurringDescription,
          init_point: String(preapproval?.init_point || preapproval?.sandbox_init_point || '') || null,
          payment_provider: 'mercadopago',
          metadata: {
            type: 'establishment_billing_subscription',
            establishment_id: String(establishmentId),
          },
          updated_at: nowIso,
        } as any,
        { onConflict: 'preapproval_id' }
      );

    if (saveError) {
      const msg = String((saveError as any)?.message || '').toLowerCase();
      const missingTable = msg.includes('relation') || msg.includes('does not exist') || msg.includes('establishment_billing_subscriptions');
      if (!missingTable) {
        return res.status(500).json({ error: 'Erro ao salvar assinatura', details: saveError });
      }
    }

    return res.status(200).json({
      subscription_type: 'establishment_billing_recurring_card',
      preapproval_id: preapprovalId,
      status: String(preapproval?.status || 'pending'),
      init_point: preapproval?.init_point || null,
      sandbox_init_point: preapproval?.sandbox_init_point || null,
      amount_cents_used: amountCents,
      amount_brl_used: amountCents / 100,
    });
  } catch (error: any) {
    return res.status(500).json({
      error:
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        'Erro ao criar assinatura recorrente no cartão',
    });
  }
});

/**
 * POST /api/mercadopago/create-subscription-checkout
 * Cria checkout externo do Mercado Pago para assinatura de cliente.
 */
router.post('/create-subscription-checkout', async (req: Request, res: Response) => {
  try {
    const { establishmentId, subscriptionId, payer, backUrl } = req.body || {};
    const payerEmail = String(payer?.email || '').trim();
    const payerName = String(payer?.name || '').trim();
    const SUBSCRIPTION_BACK_URL = String(process.env.MERCADOPAGO_SUBSCRIPTION_BACK_URL || '').trim();
    const backUrlCandidate = String(backUrl || SUBSCRIPTION_BACK_URL || '').trim();

    if (!establishmentId || !subscriptionId || !payerEmail) {
      return res.status(400).json({
        error: 'Dados incompletos',
        required: ['establishmentId', 'subscriptionId', 'payer.email'],
      });
    }

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Supabase admin não configurado' });
    }

    const { data: establishment, error: estError } = await supabaseAdmin
      .from('establishments')
      .select('id, mercadopago_access_token')
      .eq('id', String(establishmentId))
      .single();
    if (estError || !establishment) {
      return res.status(404).json({ error: 'Estabelecimento não encontrado' });
    }

    const accessToken = String((establishment as any)?.mercadopago_access_token || '').trim();
    if (!accessToken) {
      return res.status(400).json({ error: 'Estabelecimento sem Mercado Pago conectado' });
    }

    const { data: subscription, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('id, name, value')
      .eq('id', String(subscriptionId))
      .single();
    if (subError || !subscription) {
      return res.status(404).json({ error: 'Assinatura não encontrada' });
    }

    const amount = Number((subscription as any)?.value || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Valor da assinatura inválido' });
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
    // MP exige taxa de marketplace < valor da cobrança; senão o checkout recusa (ex.: assinatura R$ 1 com fee R$ 1).
    const applicationFee = rawFeeBrl > 0 && rawFeeBrl < txAmountBrl ? rawFeeBrl : 0;
    if (rawFeeBrl > 0 && applicationFee === 0) {
      console.warn('[MP preapproval] application_fee omitida: valor da assinatura insuficiente para o split', {
        txAmountBrl,
        rawFeeBrl,
        establishmentId: String(establishmentId),
        subscriptionId: String(subscriptionId),
      });
    }

    const externalReference = `subscription_preapproval:${String(establishmentId)}:${String(subscriptionId)}:${Date.now()}`;
    const title = String((subscription as any)?.name || 'Assinatura').trim();
    const MP_API_BASE_URL = String(process.env.MERCADOPAGO_API_BASE_URL || 'https://api.mercadopago.com').trim();

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
        establishment_id: String(establishmentId),
        subscription_id: String(subscriptionId),
        payer_name: payerName || null,
      },
      status: 'pending',
    };
    if (applicationFee > 0) {
      payload.application_fee = applicationFee;
    }

    if (!/^https:\/\//i.test(backUrlCandidate)) {
      return res.status(400).json({
        error: 'back_url is required',
        userMessage: 'Configure MERCADOPAGO_SUBSCRIPTION_BACK_URL com uma URL HTTPS pública.',
      });
    }
    payload.back_url = backUrlCandidate;

    const mpResponse = await axios.post(`${MP_API_BASE_URL}/preapproval`, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `sub_preapproval_${externalReference}`,
      },
    });

    const preapproval = mpResponse.data || {};
    return res.status(200).json({
      preapproval_id: String(preapproval?.id || ''),
      init_point: preapproval?.init_point || null,
      sandbox_init_point: preapproval?.sandbox_init_point || null,
      external_reference: externalReference,
      subscription_status: String(preapproval?.status || 'pending'),
      amount_brl_used: amount,
      amount_cents_used: Math.round(amount * 100),
      application_fee_brl_used: applicationFee,
      application_fee_cents_used: Math.round(applicationFee * 100),
      application_fee_applied: applicationFee > 0,
    });
  } catch (error: any) {
    return res.status(500).json({
      error:
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        'Erro ao criar checkout externo da assinatura',
    });
  }
});

/**
 * POST /api/mercadopago/get-payment-by-external-reference
 * Busca o pagamento mais recente por external_reference.
 */
router.post('/get-payment-by-external-reference', async (req: Request, res: Response) => {
  try {
    const { establishmentId, externalReference } = req.body || {};
    if (!establishmentId || !externalReference) {
      return res.status(400).json({
        error: 'Dados incompletos',
        required: ['establishmentId', 'externalReference'],
      });
    }

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Supabase admin não configurado' });
    }

    const { data: establishment, error: estError } = await supabaseAdmin
      .from('establishments')
      .select('id, mercadopago_access_token')
      .eq('id', String(establishmentId))
      .single();
    if (estError || !establishment) {
      return res.status(404).json({ error: 'Estabelecimento não encontrado' });
    }

    const accessToken = String((establishment as any)?.mercadopago_access_token || '').trim();
    if (!accessToken) {
      return res.status(400).json({ error: 'Estabelecimento sem Mercado Pago conectado' });
    }

    const MP_API_BASE_URL = String(process.env.MERCADOPAGO_API_BASE_URL || 'https://api.mercadopago.com').trim();
    const mpResponse = await axios.get(`${MP_API_BASE_URL}/v1/payments/search`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      params: {
        external_reference: String(externalReference),
        sort: 'date_created',
        criteria: 'desc',
        limit: 1,
      },
    });

    const results = Array.isArray(mpResponse?.data?.results) ? mpResponse.data.results : [];
    const payment = results[0] || null;
    if (!payment) {
      return res.status(200).json({ found: false, payment: null });
    }

    return res.status(200).json({
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
    return res.status(500).json({
      error:
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        'Erro ao buscar pagamento no Mercado Pago',
    });
  }
});

/**
 * POST /api/mercadopago/get-preapproval-status
 * Busca status da assinatura recorrente (preapproval) por id.
 */
router.post('/get-preapproval-status', async (req: Request, res: Response) => {
  try {
    const { establishmentId, preapprovalId } = req.body || {};
    if (!establishmentId || !preapprovalId) {
      return res.status(400).json({
        error: 'Dados incompletos',
        required: ['establishmentId', 'preapprovalId'],
      });
    }

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Supabase admin não configurado' });
    }

    const { data: establishment, error: estError } = await supabaseAdmin
      .from('establishments')
      .select('id, mercadopago_access_token')
      .eq('id', String(establishmentId))
      .single();
    if (estError || !establishment) {
      return res.status(404).json({ error: 'Estabelecimento não encontrado' });
    }

    const accessToken = String((establishment as any)?.mercadopago_access_token || '').trim();
    if (!accessToken) {
      return res.status(400).json({ error: 'Estabelecimento sem Mercado Pago conectado' });
    }

    const MP_API_BASE_URL = String(process.env.MERCADOPAGO_API_BASE_URL || 'https://api.mercadopago.com').trim();
    const mpResponse = await axios.get(
      `${MP_API_BASE_URL}/preapproval/${encodeURIComponent(String(preapprovalId))}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const subscription = mpResponse.data || {};
    return res.status(200).json({
      preapproval: {
        id: String(subscription?.id || ''),
        status: String(subscription?.status || ''),
        external_reference: String(subscription?.external_reference || ''),
        reason: String(subscription?.reason || ''),
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      error:
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        'Erro ao buscar status da recorrência no Mercado Pago',
    });
  }
});

/**
 * GET /api/mercadopago/recent-establishment-billing-payments
 * Lista pagamentos automáticos (regularização) recentes por estabelecimento.
 */
router.get('/recent-establishment-billing-payments', async (req: Request, res: Response) => {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Supabase admin não configurado' });
    }

    const rawDays = Number(req.query.days || 10);
    const days = Number.isFinite(rawDays) ? Math.min(30, Math.max(1, Math.floor(rawDays))) : 10;
    const nowTs = Date.now();
    const startTs = nowTs - (days * 24 * 60 * 60 * 1000);

    const { data, error } = await supabaseAdmin
      .from('establishment_billing_payments')
      .select('establishment_id, paid_at, updated_at, status, payment_provider')
      .eq('status', 'paid')
      .order('updated_at', { ascending: false })
      .limit(1000);

    if (error) {
      return res.status(500).json({
        error: 'Erro ao buscar pagamentos automáticos',
        details: String((error as any)?.message || error),
      });
    }

    const latestByEstablishment = new Map<string, { establishment_id: string; paid_at: string | null; updated_at: string | null; payment_provider: string }>();
    (data || []).forEach((row: any) => {
      const establishmentId = String(row?.establishment_id || '').trim();
      if (!establishmentId) return;

      const ts = new Date(String(row?.paid_at || row?.updated_at || '')).getTime();
      if (!Number.isFinite(ts) || ts < startTs || ts > nowTs) return;

      const current = latestByEstablishment.get(establishmentId);
      const currentTs = current ? new Date(String(current.paid_at || current.updated_at || '')).getTime() : NaN;
      if (!current || !Number.isFinite(currentTs) || ts > currentTs) {
        latestByEstablishment.set(establishmentId, {
          establishment_id: establishmentId,
          paid_at: row?.paid_at ? String(row.paid_at) : null,
          updated_at: row?.updated_at ? String(row.updated_at) : null,
          payment_provider: String(row?.payment_provider || 'mercadopago'),
        });
      }
    });

    const items = Array.from(latestByEstablishment.values()).sort((a, b) => {
      const ta = new Date(String(a.paid_at || a.updated_at || '')).getTime();
      const tb = new Date(String(b.paid_at || b.updated_at || '')).getTime();
      return tb - ta;
    });

    return res.status(200).json({ days, count: items.length, items });
  } catch (error: any) {
    return res.status(500).json({
      error: error?.message || 'Erro ao listar pagamentos automáticos',
    });
  }
});

/**
 * GET /api/mercadopago/check-status
 * Verifica o status de um pagamento
 * 
 * Query params:
 * - paymentId: ID do pagamento
 * - establishmentId: ID do estabelecimento
 */
router.get('/check-status', async (req: Request, res: Response) => {
  try {
    const paymentId = req.query.paymentId as string;
    const establishmentId = req.query.establishmentId as string;

    if (!paymentId || !establishmentId) {
      return res.status(400).json({
        error: 'paymentId e establishmentId são obrigatórios',
      });
    }

    // Buscar access_token do estabelecimento
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return res.status(500).json({
        error: 'Supabase admin não configurado',
      });
    }

    const { data: establishment, error: fetchError } = await supabaseAdmin
      .from('establishments')
      .select('mercadopago_access_token')
      .eq('id', establishmentId)
      .single();

    if (fetchError || !establishment) {
      return res.status(404).json({
        error: 'Estabelecimento não encontrado',
      });
    }

    const accessToken = (establishment as any)?.mercadopago_access_token;

    if (!accessToken) {
      return res.status(400).json({
        error: 'Estabelecimento não possui conta do Mercado Pago conectada',
      });
    }

    // Verificar status
    const payment = await checkMPPaymentStatus(Number(paymentId), String(accessToken));

    return res.status(200).json(payment);
  } catch (error: any) {
    console.error('❌ [MP Routes] Erro ao verificar status:', error);
    return res.status(500).json({
      error: error.message || 'Erro ao verificar status do pagamento',
    });
  }
});

/**
 * POST /api/mercadopago/reconcile-pending-appointments
 * Body: { establishmentId: string, maxRows?: number, lookbackDays?: number }
 */
router.post('/reconcile-pending-appointments', async (req: Request, res: Response) => {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Supabase admin não configurado' });
    }

    const establishmentId = String((req.body as any)?.establishmentId || '').trim();
    if (!establishmentId) {
      return res.status(400).json({ error: 'establishmentId é obrigatório' });
    }

    const maxRows = (req.body as any)?.maxRows;
    const lookbackDays = (req.body as any)?.lookbackDays;

    const result = await reconcilePendingMercadoPagoAppointments(supabaseAdmin, establishmentId, {
      maxRows: typeof maxRows === 'number' ? maxRows : undefined,
      lookbackDays: typeof lookbackDays === 'number' ? lookbackDays : undefined,
    });

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('❌ [MP Routes] reconcile-pending-appointments:', error);
    return res.status(500).json({
      error: error?.message || 'Erro ao reconciliar agendamentos pendentes',
    });
  }
});

/**
 * POST /api/mercadopago/webhook
 * Webhook do Mercado Pago para notificações de pagamento
 * 
 * Body: Notificação do Mercado Pago (JSON ou form-urlencoded)
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return res.status(500).json({
        error: 'Supabase admin não configurado',
      });
    }

    // Parse do body
    let webhookData: any = req.body;

    // Se vier como form-urlencoded, tentar parse do campo 'data'
    if (req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
      const dataParam = (req.body as any)?.data;
      if (dataParam && typeof dataParam === 'string') {
        try {
          webhookData = JSON.parse(dataParam);
        } catch {
          webhookData = { id: dataParam };
        }
      }
    }

    console.log('📨 [MP Webhook] Notificação recebida:', {
      type: webhookData?.type,
      action: webhookData?.action,
      id: webhookData?.id,
      data: webhookData?.data,
    });

    if (webhookData?.type === 'subscription_preapproval') {
      const preapprovalId = String(webhookData.data?.id || webhookData.id || '').trim();
      if (!preapprovalId) {
        return res.status(400).json({ error: 'preapproval id não encontrado' });
      }

      const { data: rows, error: rowsError } = await supabaseAdmin
        .from('client_subscriptions')
        .select('id, establishment_id, subscription_id, payment_status, subscription_payment_order_id')
        .eq('subscription_payment_order_id', preapprovalId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (rowsError || !Array.isArray(rows) || rows.length === 0) {
        return res.status(200).json({ message: 'Webhook preapproval recebido sem assinante vinculado' });
      }

      const establishmentId = String((rows[0] as any)?.establishment_id || '').trim();
      const { data: establishment } = await supabaseAdmin
        .from('establishments')
        .select('mercadopago_access_token')
        .eq('id', establishmentId)
        .single();
      const accessToken = String((establishment as any)?.mercadopago_access_token || '').trim();
      if (!accessToken) {
        return res.status(200).json({ message: 'Webhook preapproval recebido, mas estabelecimento sem token MP' });
      }

      const MP_API_BASE_URL = String(process.env.MERCADOPAGO_API_BASE_URL || 'https://api.mercadopago.com').trim();
      const preapprovalResp = await axios.get(
        `${MP_API_BASE_URL}/preapproval/${encodeURIComponent(preapprovalId)}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const preapproval = preapprovalResp.data || {};
      const status = String(preapproval?.status || '').toLowerCase().trim();
      if (status !== 'authorized') {
        return res.status(200).json({ message: 'Webhook preapproval recebido (não autorizado)', preapprovalId, status });
      }

      const subscriptionIds = Array.from(new Set(rows.map((r: any) => String(r.subscription_id || '').trim()).filter(Boolean)));
      const { data: subscriptionRows } = await supabaseAdmin
        .from('subscriptions')
        .select('id, duration_months')
        .in('id', subscriptionIds);
      const durationBySubscription = new Map<string, number>();
      (subscriptionRows || []).forEach((s: any) => {
        durationBySubscription.set(String(s?.id || ''), Number(s?.duration_months || 1));
      });

      const now = new Date();
      for (const row of rows as any[]) {
        const sid = String(row?.subscription_id || '').trim();
        const durationMonths = durationBySubscription.get(sid) || 1;
        const startDate = toISODate(now);
        const endDate = toISODate(addMonths(now, Number.isFinite(durationMonths) && durationMonths > 0 ? durationMonths : 1));

        await supabaseAdmin
          .from('client_subscriptions')
          .update({
            payment_status: 'paid',
            last_payment_date: startDate,
            start_date: startDate,
            end_date: endDate,
            subscriber_payment_method: 'credito',
            subscription_payment_provider: 'mercadopago_card_recurring',
            subscription_payment_order_id: preapprovalId,
          } as any)
          .eq('id', String((row as any).id));
      }

      return res.status(200).json({
        message: 'Webhook de assinatura recorrente processado automaticamente',
        preapprovalId,
        updatedSubscribers: rows.length,
      });
    } else if (webhookData?.type === 'payment') {
      const paymentId = webhookData.data?.id || webhookData.id;

      if (!paymentId) {
        return res.status(400).json({ error: 'Payment ID não encontrado' });
      }

      // Buscar agendamento
      const { data: appointments } = await supabaseAdmin
        .from('appointments')
        .select('id, establishment_id, payment_transaction_id, status, payment_method, payment_status')
        .eq('payment_transaction_id', String(paymentId))
        .limit(1);

      if (!appointments || appointments.length === 0) {
        const platformAccessToken = String(process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim();
        if (platformAccessToken) {
          try {
            const payment = await checkMPPaymentStatus(Number(paymentId), platformAccessToken);
            const externalReference = String((payment as any)?.external_reference || '').trim();
            const subscriptionCheckoutPrefix = 'subscription_checkout:';

            if (externalReference.startsWith(subscriptionCheckoutPrefix)) {
              const parts = externalReference.split(':');
              const establishmentId = String(parts[1] || '').trim();
              const subscriptionId = String(parts[2] || '').trim();
              const subscriptionStatus = normalizeSubscriptionPaymentStatus((payment as any)?.status);

              if (establishmentId && subscriptionId) {
                const lookupOrderIds = [externalReference, String(paymentId)].filter(Boolean);
                const { data: subscriberRows, error: subscriberFetchError } = await supabaseAdmin
                  .from('client_subscriptions')
                  .select('id, payment_status, subscription_payment_order_id')
                  .eq('establishment_id', establishmentId)
                  .eq('subscription_id', subscriptionId)
                  .in('subscription_payment_order_id', lookupOrderIds)
                  .order('created_at', { ascending: false })
                  .limit(20);

                if (subscriberFetchError) {
                  console.error('❌ [MP Webhook] Erro ao buscar assinatura pendente (checkout externo):', subscriberFetchError);
                } else if (Array.isArray(subscriberRows) && subscriberRows.length > 0) {
                  if (subscriptionStatus === 'paid') {
                    const ids = subscriberRows.map((r: any) => String(r.id)).filter(Boolean);
                    if (ids.length > 0) {
                      const { error: subscriberUpdateError } = await supabaseAdmin
                        .from('client_subscriptions')
                        .update({
                          payment_status: 'paid',
                          last_payment_date: toISODate(new Date()),
                          subscriber_payment_method: 'credito',
                          subscription_payment_provider: 'mercadopago_card',
                          subscription_payment_order_id: String(paymentId),
                        } as any)
                        .in('id', ids);

                      if (!subscriberUpdateError) {
                        return res.status(200).json({
                          message: 'Webhook de assinatura externa processado automaticamente',
                          establishmentId,
                          subscriptionId,
                          paymentId: String(paymentId),
                          paymentStatus: String((payment as any)?.status || ''),
                          updatedSubscribers: ids.length,
                        });
                      }
                    }
                  } else {
                    return res.status(200).json({
                      message: 'Webhook de assinatura externa recebido (ainda não aprovado)',
                      establishmentId,
                      subscriptionId,
                      paymentId: String(paymentId),
                      paymentStatus: String((payment as any)?.status || ''),
                    });
                  }
                }
              }
            }
          } catch (externalErr) {
            console.warn('⚠️ [MP Webhook] Falha ao processar assinatura externa automática:', externalErr);
          }
        }

        const platformAccessTokenFallback = String(process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim();
        if (platformAccessTokenFallback) {
          try {
            const paymentMeta = await checkMPPaymentStatus(Number(paymentId), platformAccessTokenFallback);
            const fb = await confirmPendingAppointmentFromMpPaymentMetadata(
              supabaseAdmin,
              String(paymentId),
              paymentMeta
            );
            if (fb.ok) {
              return res.status(200).json({
                message: 'Webhook agendamento confirmado via external_reference/metadata',
                appointmentId: fb.appointmentId,
                paymentId: String(paymentId),
              });
            }
          } catch (metaErr) {
            console.warn('⚠️ [MP Webhook] Fallback metadata agendamento:', metaErr);
          }
        }

        return res.status(200).json({ message: 'Webhook recebido, mas agendamento não encontrado' });
      }

      const appointment = appointments[0];

      // Buscar access_token do estabelecimento
      const { data: establishment } = await supabaseAdmin
        .from('establishments')
        .select('mercadopago_access_token')
        .eq('id', appointment.establishment_id)
        .single();

      if (!establishment || !(establishment as any)?.mercadopago_access_token) {
        return res.status(200).json({ message: 'Webhook recebido, mas estabelecimento não configurado' });
      }

      // Verificar status do pagamento
      const payment = await checkMPPaymentStatus(
        Number(paymentId),
        String((establishment as any).mercadopago_access_token)
      );

      if (payment.status === 'approved' || payment.status === 'authorized') {
        // Converter payment_method_id do Mercado Pago para o formato do sistema
        // Sempre usar o payment_method_id do pagamento (fonte mais confiável)
        const paymentMethodId = String(payment.payment_method_id || '').toLowerCase();
        let paymentMethod = 'pix'; // Padrão

        if (paymentMethodId === 'credit_card') {
          paymentMethod = 'credito';
        } else if (paymentMethodId === 'debit_card') {
          paymentMethod = 'debito';
        } else if (paymentMethodId === 'pix') {
          paymentMethod = 'pix';
        }

        await supabaseAdmin
          .from('appointments')
          .update({
            status: 'confirmed',
            payment_status: 'paid',
            payment_method: paymentMethod,
            pix_payment_status: payment.payment_method_id === 'pix' ? 'aprovado' : null,
          })
          .eq('id', appointment.id);

        return res.status(200).json({
          message: 'Webhook processado com sucesso',
          appointmentId: appointment.id,
          paymentStatus: payment.status,
        });
      }

      return res.status(200).json({
        message: 'Webhook processado',
        paymentStatus: payment.status,
      });
    }

    return res.status(200).json({
      message: 'Webhook recebido',
      type: webhookData?.type,
    });
  } catch (error: any) {
    console.error('❌ [MP Webhook] Erro:', error);
    return res.status(200).json({
      error: 'Erro ao processar webhook',
      message: error.message,
    });
  }
});

export default router;
