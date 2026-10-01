import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { refreshAccessToken } from '../../src/lib/mercadopago/mp-oauth';
import { createMPPayment, CreateMPPaymentRequest } from '../../src/lib/mercadopago/mp-service';
import {
  PLATFORM_COLLECTOR_METADATA_KEY,
  PLATFORM_COLLECTOR_VALUE,
  getPlatformMercadoPagoAccessToken,
  getPlatformMercadoPagoUserId,
  recordPlatformCollectedPayment,
} from '../../src/lib/mercadopago/platformWallet';
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

// Grava a "saúde" da conexão MP do estabelecimento (colunas mercadopago_health*),
// para o painel parar de mostrar "conectado" quando a conta caiu no Mercado Pago.
// Best-effort DE VERDADE: nunca lança e nunca toca em token — se as colunas ainda
// não existirem no banco ou o update falhar, o fluxo de pagamento segue como sempre.
export async function markMercadoPagoHealthBestEffort(
  establishmentId: string,
  health: 'ok' | 'reconnect_required',
  errorMessage?: string | null,
): Promise<void> {
  try {
    if (!supabaseAdmin) return;
    await supabaseAdmin
      .from('establishments')
      .update({
        mercadopago_health: health,
        mercadopago_health_error: errorMessage ? String(errorMessage).slice(0, 500) : null,
        mercadopago_health_at: new Date().toISOString(),
      } as any)
      .eq('id', establishmentId);
  } catch {
    // silencioso de propósito: saúde é diagnóstico, jamais pode derrubar pagamento
  }
}

// Exportada para ser reusada pela cobrança PIX de balcão
// (mercadopago-create-appointment-local-charge.ts). Duplicar a lógica de
// refresh do token em dois lugares seria pedir para elas divergirem.
export async function getValidMercadoPagoAccessToken(establishmentId: string): Promise<string> {
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
    const noAccountErr: any = new Error('Estabelecimento não possui conta do Mercado Pago conectada');
    noAccountErr.code = 'NO_MP_ACCOUNT';
    throw noAccountErr;
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
    // Sem refresh_token não há renovação possível: estado permanente até reconectar.
    await markMercadoPagoHealthBestEffort(
      establishmentId,
      'reconnect_required',
      'Token expirado e sem refresh_token salvo. Necessário reconectar o Mercado Pago.'
    );
    throw new Error('Mercado Pago expirado e sem refresh_token. Reconecte o Mercado Pago.');
  }

  // Refresh do token
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

  // Renovou com sucesso = conexão saudável (limpa alerta antigo, se houver).
  // Update separado de propósito: se as colunas de saúde ainda não existirem,
  // o salvamento dos tokens acima NÃO pode ser afetado.
  await markMercadoPagoHealthBestEffort(establishmentId, 'ok', null);

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

    // Botão do ADMIN "retirar obrigatoriedade de pagamento online": esta barbearia só
    // recebe no local. Recusa aqui também, mesmo que alguma tela antiga tente cobrar.
    try {
      const { data: blockRow } = await supabaseAdmin
        .from('establishments')
        .select('online_payment_blocked_by_admin')
        .eq('id', String(establishmentId))
        .maybeSingle();
      if ((blockRow as any)?.online_payment_blocked_by_admin === true) {
        return json(400, {
          error: 'Pagamento online desativado para este estabelecimento',
          userMessage: 'Este estabelecimento recebe apenas no local. Seu horário fica confirmado e você paga na hora.',
        });
      }
    } catch {
      // coluna ainda não existe ou falha de rede: segue o fluxo normal
    }

    // Quem recebe este pagamento?
    // - Estabelecimento com Mercado Pago conectado: token dele + application_fee (split).
    // - Estabelecimento SEM Mercado Pago: token da PLATAFORMA (conta do Agendei Fácil).
    //   O valor cai na nossa conta e vira saldo do estabelecimento (carteira/saque),
    //   já descontando a taxa do MP e R$ 1,00 de serviço — ver platformWallet.ts.
    let accessToken: string;
    let collectedByPlatform = false;
    try {
      accessToken = await getValidMercadoPagoAccessToken(String(establishmentId));
    } catch (e: any) {
      const msg = String(e?.message || 'Falha ao obter token do Mercado Pago');
      const semConta = e?.code === 'NO_MP_ACCOUNT' || msg.toLowerCase().includes('não possui conta');
      const platformToken = semConta ? getPlatformMercadoPagoAccessToken() : '';
      if (!platformToken) {
        return json(400, {
          error: msg,
          userMessage: semConta
            ? 'Pagamento online indisponível para este estabelecimento no momento.'
            : 'Reconecte a conta do Mercado Pago do estabelecimento e tente novamente.',
        });
      }
      accessToken = platformToken;
      collectedByPlatform = true;
      console.log('🏦 [MP Create Payment] Estabelecimento sem MP: cobrando pela conta da plataforma', { establishmentId });
    }

    // Estabelecimento conectado com a PRÓPRIA conta da plataforma (ex.: conta de teste):
    // o Mercado Pago recusa application_fee ("You cannot use application_fee with this
    // payment") porque não dá para cobrar taxa de si mesmo. O dinheiro cai na nossa conta
    // de qualquer jeito, então trata como cobrança pela plataforma (sem fee, vira carteira).
    if (!collectedByPlatform && supabaseAdmin) {
      try {
        const { data: estRow } = await supabaseAdmin
          .from('establishments')
          .select('mercadopago_user_id')
          .eq('id', String(establishmentId))
          .maybeSingle();
        const estUserId = String((estRow as any)?.mercadopago_user_id || '').trim();
        if (estUserId) {
          const platformUserId = await getPlatformMercadoPagoUserId();
          if (platformUserId && estUserId === platformUserId) {
            collectedByPlatform = true;
            accessToken = getPlatformMercadoPagoAccessToken() || accessToken;
            console.log('🏦 [MP Create Payment] Estabelecimento conectado com a conta da própria plataforma: sem application_fee (carteira)', { establishmentId });
          }
        }
      } catch (e: any) {
        console.warn('⚠️ [MP Create Payment] Não consegui comparar a conta MP do estabelecimento com a da plataforma:', e?.message || e);
      }
    }

    // Taxa da plataforma (centavos) para Mercado Pago.
    // Regras:
    // - Cartão: prioriza MERCADOPAGO_CREDIT_PLATFORM_FEE_CENTS (fallback 100 = R$1,00)
    // - PIX: mantém MERCADOPAGO_PLATFORM_FEE_CENTS / PLATFORM_FEE_CENTS (fallback 50 = R$0,50)
    // - Pela conta da plataforma: SEM application_fee (100% cai na nossa conta; o R$ 1,00
    //   é descontado na carteira, não no Mercado Pago).
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
    const applicationFee = collectedByPlatform ? undefined : Number(String(applicationFeeRaw).trim());
    const metadataFinal = {
      ...(metadata && typeof metadata === 'object' ? metadata : {}),
      establishment_id: String(establishmentId),
      ...(collectedByPlatform ? { [PLATFORM_COLLECTOR_METADATA_KEY]: PLATFORM_COLLECTOR_VALUE } : {}),
    };

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
      ...(applicationFee !== undefined ? { application_fee: applicationFee } : {}),
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
      metadata: metadataFinal,
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

    const returnedFee = Number((payment as any)?.application_fee ?? 0);
    const expectedFee = Number((paymentData.application_fee || 0) / 100);
    const feeIsValid = collectedByPlatform || (Number.isFinite(returnedFee) && Math.abs(returnedFee - expectedFee) < 0.0001);
    if (!feeIsValid) {
      console.warn('⚠️ [MP Create Payment] Taxa divergente detectada (sem bloquear pagamento):', {
        establishmentId,
        paymentId: (payment as any)?.id,
        expectedFee,
        returnedFee,
      });
    }

    console.log('✅ [MP Create Payment] Pagamento criado:', {
      paymentId: payment.id,
      status: payment.status,
      establishmentId,
      collector: collectedByPlatform ? 'platform' : 'establishment',
    });

    // Cartão aprovado NA HORA pela conta da plataforma: já credita a carteira do
    // estabelecimento (o front confirma o agendamento sem passar pelo check-status).
    // Idempotente por mp_payment_id — o webhook pode gravar de novo sem duplicar.
    if (collectedByPlatform && supabaseAdmin) {
      const st = String((payment as any)?.status || '').toLowerCase();
      if (st === 'approved' || st === 'authorized') {
        await recordPlatformCollectedPayment(supabaseAdmin, {
          establishmentId: String(establishmentId),
          appointmentId: String((metadataFinal as any)?.appointment_id || '').trim() || null,
          payment,
        });
      }
    }

    return json(200, {
      ...payment,
      fee_expected: expectedFee,
      fee_returned: returnedFee,
      fee_validation: feeIsValid ? 'ok' : 'divergent',
      fee_version: `R$${((applicationFee ?? 0) / 100).toFixed(2).replace('.', ',')}`,
      application_fee_cents_expected: applicationFee ?? 0,
      fee_mode: isCardPayment ? 'credit_card' : 'pix',
      collector: collectedByPlatform ? 'platform' : 'establishment',
    });
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
        ? 'PIX indisponível no Mercado Pago deste estabelecimento no momento. Tente cartão ou pague no local.'
        : undefined,
    });
  }
};
