/**
 * Mercado Pago Routes - Rotas OAuth e pagamentos
 * 
 * Define as rotas para OAuth e criação de pagamentos do Mercado Pago
 */

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { getAuthorizationUrl, exchangeCodeForToken } from './mp.oauth';
import { createMPPayment, checkMPPaymentStatus, CreateMPPaymentRequest } from './mp.service';

const router = Router();

// Supabase Admin (bypass RLS)
const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

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

    // Taxa da plataforma: R$ 0,50 (50 centavos)
    const applicationFee = 50;

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
      },
      application_fee: applicationFee,
      access_token: String(accessToken),
      payment_method_id: payment_method_id || 'pix',
      ...(installments ? { installments: Number(installments) } : {}),
      ...(metadata ? { metadata } : {}),
    };

    const payment = await createMPPayment(paymentData);

    console.log('✅ [MP Routes] Pagamento criado:', {
      paymentId: payment.id,
      status: payment.status,
      establishmentId,
    });

    return res.status(200).json(payment);
  } catch (error: any) {
    console.error('❌ [MP Routes] Erro ao criar pagamento:', error);
    return res.status(500).json({
      error: error.message || 'Erro ao criar pagamento',
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

export default router;
