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
    // Compat: usa MERCADOPAGO_PLATFORM_FEE_CENTS e, se não existir, cai em PLATFORM_FEE_CENTS.
    const applicationFee = Number(
      String(
        process.env.MERCADOPAGO_PLATFORM_FEE_CENTS ||
        process.env.PLATFORM_FEE_CENTS ||
        '100'
      ).trim()
    );

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

    const payment = await createMPPayment({
      amount: amountCents,
      description: billingDescription,
      payer: { email: payerEmail },
      access_token: platformAccessToken,
      payment_method_id: 'pix',
      metadata: {
        type: 'establishment_billing',
        establishment_id: String(establishmentId),
        source: 'establishment_dashboard',
        created_at: new Date().toISOString(),
      },
    });

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
          qr_code: String(pixData?.qr_code || '') || null,
          qr_code_base64: String(pixData?.qr_code_base64 || '') || null,
          metadata: {
            type: 'establishment_billing',
            establishment_id: String(establishmentId),
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

    if (webhookData?.type === 'payment') {
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
