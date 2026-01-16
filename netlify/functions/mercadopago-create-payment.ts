import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
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

    const { data: establishment, error: fetchError } = await supabaseAdmin
      .from('establishments')
      .select('id, mercadopago_access_token, mercadopago_user_id')
      .eq('id', establishmentId)
      .single();

    if (fetchError || !establishment) {
      return json(404, {
        error: 'Estabelecimento não encontrado',
      });
    }

    const accessToken = (establishment as any)?.mercadopago_access_token;

    if (!accessToken) {
      return json(400, {
        error: 'Estabelecimento não possui conta do Mercado Pago conectada',
        userMessage: 'Conecte a conta do Mercado Pago antes de criar pagamentos',
      });
    }

    // Taxa da plataforma: R$ 0,50 (50 centavos)
    const applicationFee = 50;

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
      // ✅ REPASSAR payment_method_id exatamente como veio (não alterar)
      payment_method_id: payment_method_id || 'pix',
      // ✅ REPASSAR installments exatamente como veio (não alterar)
      ...(installments ? { installments: Number(installments) } : {}),
      // ✅ REPASSAR token exatamente como veio (não alterar)
      ...(token ? { token: String(token) } : {}),
      // ✅ REPASSAR issuer_id exatamente como veio (não alterar)
      ...(issuer_id ? { issuer_id: String(issuer_id) } : {}),
      ...(metadata ? { metadata } : {}),
    };

    // ✅ Logs detalhados ANTES de criar pagamento (objetivo: debug diff_param_bins)
    console.log('📤 [MP Create Payment] Dados que serão enviados para Mercado Pago:', {
      payment_method_id: paymentData.payment_method_id,
      token: paymentData.token ? String(paymentData.token).substring(0, 10) + '...' : 'NÃO ENVIADO',
      issuer_id: (paymentData as any).issuer_id || 'NÃO ENVIADO',
      installments: paymentData.installments || 'NÃO ENVIADO',
      amount: paymentData.amount,
      application_fee: paymentData.application_fee,
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
    return json(500, {
      error: error.message || 'Erro ao criar pagamento',
    });
  }
};
