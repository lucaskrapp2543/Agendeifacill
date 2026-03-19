import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { refreshAccessToken } from '../../src/lib/mercadopago/mp-oauth';
import { createMPPayment, CreateMPPaymentRequest } from '../../src/lib/mercadopago/mp-service';
import { json, parseJsonBody } from './_utils';

// Supabase Admin (bypass RLS)
const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
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

  if (!accessToken) {
    throw new Error('Estabelecimento não possui conta do Mercado Pago conectada');
  }

  // Se não temos expires_at, assume token válido (fallback)
  if (!expiresAtRaw) return accessToken;

  const expiresAt = new Date(expiresAtRaw);
  const now = Date.now();
  const safetyMs = 2 * 60 * 1000; // 2 min de folga
  if (Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() > now + safetyMs) {
    return accessToken;
  }

  if (!refreshToken) {
    throw new Error('Mercado Pago expirado e sem refresh_token. Reconecte o Mercado Pago.');
  }

  // Refresh do token
  const refreshed = await refreshAccessToken(refreshToken);
  const newAccessToken = String(refreshed.access_token || '').trim();
  const newRefreshToken = String(refreshed.refresh_token || refreshToken).trim();
  const expiresIn = Number(refreshed.expires_in || 21600);
  const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  if (!newAccessToken) {
    throw new Error('Falha ao atualizar token do Mercado Pago');
  }

  await supabaseAdmin
    .from('establishments')
    .update({
      mercadopago_access_token: newAccessToken,
      mercadopago_refresh_token: newRefreshToken,
      mercadopago_token_expires_at: newExpiresAt,
    } as any)
    .eq('id', establishmentId);

  console.log('✅ [MP Create Payment] access_token renovado automaticamente', { establishmentId });
  return newAccessToken;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' }, { Allow: 'POST' });
  }

  try {
    const body = parseJsonBody<any>(event) || {};
    const {
      establishmentId,
      amount,
      description,
      payer,
      payment_method_id,
      installments,
      token,
      issuer_id, // ✅ Capturar issuer_id se vier do frontend
      metadata,
    } = body;

    // ✅ Logs detalhados ANTES de processar (objetivo: debug diff_param_bins)
    console.log('📥 [MP Create Payment] Dados recebidos do frontend:', {
      establishmentId,
      amount,
      description: String(description).substring(0, 50),
      payment_method_id: payment_method_id || 'NÃO ENVIADO',
      token: token ? String(token).substring(0, 10) + '...' : 'NÃO ENVIADO',
      issuer_id: issuer_id || 'NÃO ENVIADO',
      installments: installments || 'NÃO ENVIADO',
      payerEmail: payer?.email ? String(payer.email).substring(0, 20) + '...' : 'NÃO ENVIADO',
      payerIdentification: payer?.identification
        ? `${payer.identification.type}: ${String(payer.identification.number).substring(0, 3)}***`
        : 'NÃO ENVIADO',
      metadata: metadata || 'NÃO ENVIADO',
      appointment_id: metadata?.appointment_id || 'NÃO ENVIADO',
    });

    // Validação
    if (!establishmentId || !amount || !description || !payer?.email) {
      return json(400, {
        error: 'Dados incompletos',
        required: ['establishmentId', 'amount', 'description', 'payer.email'],
      });
    }

    // Buscar access_token do estabelecimento
    if (!supabaseAdmin) {
      return json(500, {
        error: 'Supabase admin não configurado',
      });
    }

    let accessToken: string;
    try {
      accessToken = await getValidMercadoPagoAccessToken(String(establishmentId));
    } catch (e: any) {
      const msg = String(e?.message || 'Falha ao obter token do Mercado Pago');
      return json(400, {
        error: msg,
        userMessage: 'Reconecte a conta do Mercado Pago do estabelecimento e tente novamente.',
      });
    }

    // Taxa da plataforma: R$ 1,00 (100 centavos)
    const applicationFee = 100;

    // ✅ VALIDAÇÃO CRÍTICA: Se for pagamento com cartão, payment_method_id e issuer_id são OBRIGATÓRIOS
    // ✅ REMOVIDO: Nunca usar 'credit_card' ou inferir valores
    if (token) {
      // Se tem token, é pagamento com cartão
      if (!payment_method_id || payment_method_id === 'credit_card') {
        return json(400, {
          error: 'payment_method_id inválido',
          message: 'Para pagamento com cartão, payment_method_id deve ser a bandeira específica (visa, master, elo, etc.), não "credit_card" genérico.',
          userMessage: 'Erro ao processar pagamento. Verifique os dados do cartão.',
        });
      }

      if (!issuer_id) {
        return json(400, {
          error: 'issuer_id obrigatório',
          message: 'Para pagamento com cartão, issuer_id (ID do banco emissor) é obrigatório.',
          userMessage: 'Erro ao processar pagamento. Verifique os dados do cartão.',
        });
      }
    }

    // ✅ CRÍTICO: Apenas REPASSAR os dados recebidos (sem alterar payment_method_id, issuer_id ou installments)
    // O objetivo é garantir que os dados do token sejam preservados
    const paymentData: CreateMPPaymentRequest = {
      amount: Math.round(Number(amount)),
      description: String(description),
      payer: {
        email: String(payer.email),
        ...(payer.first_name ? { first_name: String(payer.first_name) } : {}),
        ...(payer.last_name ? { last_name: String(payer.last_name) } : {}),
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
      // ✅ REPASSAR payment_method_id exatamente como veio (NUNCA inferir ou alterar)
      // ✅ REMOVIDO: Não usar fallback 'pix' se vier token (seria cartão)
      payment_method_id: payment_method_id || (token ? undefined : 'pix'), // Se tem token, payment_method_id é obrigatório
      // ✅ REPASSAR installments exatamente como veio (não alterar)
      ...(installments ? { installments: Number(installments) } : {}),
      // ✅ REPASSAR token exatamente como veio (não alterar)
      ...(token ? { token: String(token) } : {}),
      // ✅ REPASSAR issuer_id exatamente como veio (não alterar)
      ...(issuer_id ? { issuer_id: String(issuer_id) } : {}),
      ...(metadata ? { metadata } : {}),
    };

    // ✅ VALIDAÇÃO FINAL: Se payment_method_id não foi fornecido e há token, erro
    if (token && !paymentData.payment_method_id) {
      return json(400, {
        error: 'payment_method_id obrigatório',
        message: 'Para pagamento com cartão, payment_method_id (bandeira do cartão) é obrigatório.',
        userMessage: 'Erro ao processar pagamento. Verifique os dados do cartão.',
      });
    }

    // ✅ Logs detalhados ANTES de criar pagamento (objetivo: debug diff_param_bins)
    console.log('📤 [MP Create Payment] Dados que serão enviados para Mercado Pago:', {
      payment_method_id: paymentData.payment_method_id || 'NÃO ENVIADO',
      token: paymentData.token ? String(paymentData.token).substring(0, 10) + '...' : 'NÃO ENVIADO',
      issuer_id: (paymentData as any).issuer_id || 'NÃO ENVIADO',
      installments: paymentData.installments || 'NÃO ENVIADO',
      amount: paymentData.amount,
      application_fee: paymentData.application_fee,
      // ✅ Verificar se não há 'credit_card' hardcoded
      hasCreditCardHardcoded: paymentData.payment_method_id === 'credit_card',
    });

    const payment = await createMPPayment(paymentData);

    console.log('✅ [MP Create Payment] Pagamento criado:', {
      paymentId: payment.id,
      status: payment.status,
      establishmentId,
    });

    return json(200, payment);
  } catch (error: any) {
    console.error('❌ [MP Create Payment] Erro:', error);
    const rawMsg = String(error?.message || '').trim();
    const lower = rawMsg.toLowerCase();
    const isPixNotEnabled =
      lower.includes('without key enabled') ||
      lower.includes('collector user') ||
      lower.includes('financial identity') ||
      lower.includes('qr render');

    return json(500, {
      error: rawMsg || 'Erro ao criar pagamento',
      userMessage: isPixNotEnabled
        ? 'PIX indisponível no Mercado Pago deste barbeiro. Ele precisa ativar/cadastrar uma chave PIX no app do Mercado Pago para gerar QR Code.'
        : undefined,
    });
  }
};
