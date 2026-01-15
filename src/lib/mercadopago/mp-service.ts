/**
 * Mercado Pago Service - Criação de pagamentos
 * 
 * Gerencia a criação de pagamentos no Mercado Pago Marketplace
 * com application_fee para a plataforma
 * 
 * ⚠️ IMPORTANTE: Este arquivo NUNCA deve ser importado no frontend!
 * Use apenas em: Edge Functions, Serverless Functions, API Routes
 */

import axios from 'axios';

function getMPApiBaseUrl(): string {
  return process.env.MERCADOPAGO_API_BASE_URL || 'https://api.mercadopago.com';
}

/**
 * Interface para dados do pagamento
 */
export interface CreateMPPaymentRequest {
  amount: number; // Valor em centavos (ex: 1000 = R$ 10,00)
  description: string;
  payer: {
    email: string;
    identification?: {
      type: 'CPF' | 'CNPJ';
      number: string;
    };
  };
  application_fee: number; // Taxa da plataforma em centavos (ex: 50 = R$ 0,50)
  access_token: string; // Access token do vendedor
  metadata?: Record<string, any>;
  payment_method_id?: string; // 'pix', 'credit_card', etc.
  installments?: number; // Para cartão de crédito
  statement_descriptor?: string;
}

/**
 * Interface para resposta do pagamento
 */
export interface CreateMPPaymentResponse {
  id: number;
  status: string;
  status_detail: string;
  transaction_amount: number;
  currency_id: string;
  date_created: string;
  date_approved?: string;
  payment_method_id: string;
  payer: {
    id: string;
    email: string;
  };
  application_fee: number;
  metadata?: Record<string, any>;
}

/**
 * Cria um pagamento no Mercado Pago Marketplace
 * 
 * @param paymentData - Dados do pagamento
 * @returns Dados do pagamento criado
 */
export async function createMPPayment(
  paymentData: CreateMPPaymentRequest
): Promise<CreateMPPaymentResponse> {
  const { access_token, amount, application_fee, ...rest } = paymentData;

  if (!access_token) {
    throw new Error('access_token é obrigatório');
  }

  if (!amount || amount <= 0) {
    throw new Error('amount deve ser maior que zero');
  }

  if (application_fee < 0 || application_fee >= amount) {
    throw new Error('application_fee deve ser entre 0 e o valor do pagamento');
  }

  try {
    console.log('💳 [MP Payment] Criando pagamento:', {
      amount,
      application_fee,
      description: paymentData.description,
      payerEmail: paymentData.payer.email,
      hasAccessToken: !!access_token,
    });

    const MP_API_BASE_URL = getMPApiBaseUrl();

    // Montar payload para a API do Mercado Pago
    const payload: any = {
      transaction_amount: amount / 100, // Converter centavos para reais
      description: paymentData.description,
      payment_method_id: paymentData.payment_method_id || 'pix', // Padrão: PIX
      payer: {
        email: paymentData.payer.email,
        ...(paymentData.payer.identification
          ? {
              identification: {
                type: paymentData.payer.identification.type,
                number: paymentData.payer.identification.number.replace(/\D/g, ''), // Remover formatação
              },
            }
          : {}),
      },
      application_fee: application_fee / 100, // Converter centavos para reais
      ...(paymentData.metadata ? { metadata: paymentData.metadata } : {}),
      ...(paymentData.statement_descriptor
        ? { statement_descriptor: paymentData.statement_descriptor }
        : {}),
    };

    // Para cartão de crédito, adicionar installments
    if (paymentData.payment_method_id === 'credit_card' && paymentData.installments) {
      payload.installments = paymentData.installments;
    }

    // Criar pagamento usando o access_token do vendedor
    const response = await axios.post(
      `${MP_API_BASE_URL}/v1/payments`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': `mp_${Date.now()}_${Math.random().toString(36).substring(7)}`, // Prevenir duplicatas
        },
      }
    );

    const payment = response.data;

    console.log('✅ [MP Payment] Pagamento criado:', {
      id: payment.id,
      status: payment.status,
      status_detail: payment.status_detail,
      amount: payment.transaction_amount,
      application_fee: payment.application_fee,
    });

    return {
      id: payment.id,
      status: payment.status,
      status_detail: payment.status_detail,
      transaction_amount: payment.transaction_amount,
      currency_id: payment.currency_id || 'BRL',
      date_created: payment.date_created,
      date_approved: payment.date_approved,
      payment_method_id: payment.payment_method_id,
      payer: {
        id: String(payment.payer?.id || ''),
        email: payment.payer?.email || '',
      },
      application_fee: payment.application_fee || application_fee / 100,
      metadata: payment.metadata,
    };
  } catch (error: any) {
    console.error('❌ [MP Payment] Erro ao criar pagamento:', {
      message: error?.message,
      response: error?.response?.data,
      status: error?.response?.status,
    });

    const errorMessage =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.message ||
      'Erro ao criar pagamento no Mercado Pago';

    throw new Error(errorMessage);
  }
}

/**
 * Verifica o status de um pagamento
 * 
 * @param paymentId - ID do pagamento
 * @param accessToken - Access token do vendedor
 * @returns Status do pagamento
 */
export async function checkMPPaymentStatus(
  paymentId: number,
  accessToken: string
): Promise<CreateMPPaymentResponse> {
  if (!accessToken) {
    throw new Error('access_token é obrigatório');
  }

  try {
    console.log('🔍 [MP Payment] Verificando status:', { paymentId });

    const MP_API_BASE_URL = getMPApiBaseUrl();
    const response = await axios.get(`${MP_API_BASE_URL}/v1/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const payment = response.data;

    return {
      id: payment.id,
      status: payment.status,
      status_detail: payment.status_detail,
      transaction_amount: payment.transaction_amount,
      currency_id: payment.currency_id || 'BRL',
      date_created: payment.date_created,
      date_approved: payment.date_approved,
      payment_method_id: payment.payment_method_id,
      payer: {
        id: String(payment.payer?.id || ''),
        email: payment.payer?.email || '',
      },
      application_fee: payment.application_fee || 0,
      metadata: payment.metadata,
    };
  } catch (error: any) {
    console.error('❌ [MP Payment] Erro ao verificar status:', {
      message: error?.message,
      response: error?.response?.data,
    });

    throw new Error(
      error?.response?.data?.message ||
      error?.message ||
      'Erro ao verificar status do pagamento'
    );
  }
}
