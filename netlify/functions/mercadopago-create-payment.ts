import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { createMPPayment, CreateMPPaymentRequest } from '../../server/mercadopago/mp.service';
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
      metadata,
    } = body;

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
