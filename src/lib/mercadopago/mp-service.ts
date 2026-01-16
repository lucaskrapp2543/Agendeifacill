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
    first_name?: string; // Nome do titular (necessário para cartão)
    last_name?: string; // Sobrenome do titular (necessário para cartão)
    identification?: {
      type: 'CPF' | 'CNPJ';
      number: string;
    };
    address?: {
      zip_code: string;
      street_name: string;
      street_number: number;
      neighborhood?: string;
      city: string;
      federal_unit: string;
    };
  };
  application_fee: number; // Taxa da plataforma em centavos (ex: 50 = R$ 0,50)
  access_token: string; // Access token do vendedor
  metadata?: Record<string, any>;
  payment_method_id?: string; // 'pix', 'credit_card', 'visa', 'master', etc. (vem do token)
  installments?: number; // Para cartão de crédito (vem do frontend/API)
  token?: string; // Token do cartão (obrigatório para credit_card, sempre recriado)
  issuer_id?: string; // ID do banco emissor (vem do token, pode ser opcional)
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
  
  // Validar que application_fee não é maior que 10% do valor (recomendação do Mercado Pago)
  const maxApplicationFee = Math.floor(amount * 0.1); // Máximo 10%
  if (application_fee > maxApplicationFee) {
    console.warn(`⚠️ [MP Payment] application_fee (${application_fee}) é maior que 10% do valor (${maxApplicationFee}). Isso pode causar problemas.`);
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
    const transactionAmount = amount / 100; // Converter centavos para reais
    const applicationFeeAmount = application_fee / 100; // Converter centavos para reais
    
    console.log('💰 [MP Payment] Valores do split:', {
      transaction_amount: transactionAmount,
      application_fee: applicationFeeAmount,
      vendedor_recebe: transactionAmount - applicationFeeAmount,
      plataforma_recebe: applicationFeeAmount,
    });
    
    // ✅ Log detalhado do objeto payer antes de montar o payload (para debug diff_param_bins)
    console.log('👤 [MP Payment] Objeto payer que será enviado:', {
      email: paymentData.payer.email,
      first_name: paymentData.payer.first_name || 'NÃO ENVIADO',
      last_name: paymentData.payer.last_name || 'NÃO ENVIADO',
      identification: paymentData.payer.identification 
        ? {
            type: paymentData.payer.identification.type,
            number: paymentData.payer.identification.number.substring(0, 3) + '***' + paymentData.payer.identification.number.substring(paymentData.payer.identification.number.length - 3),
          }
        : 'NÃO ENVIADO',
      hasAddress: !!paymentData.payer.address,
    });
    
    // ✅ CRÍTICO: external_reference é usado pelo webhook para identificar o pagamento
    // Deve ser uma string única que identifica o agendamento
    const externalReference = paymentData.metadata?.appointment_id 
      ? `appointment_${paymentData.metadata.appointment_id}`
      : undefined;

    const payload: any = {
      transaction_amount: transactionAmount,
      description: paymentData.description,
      payment_method_id: paymentData.payment_method_id || 'pix', // Padrão: PIX
      payer: {
        email: paymentData.payer.email,
        // ✅ CRÍTICO: Incluir first_name e last_name se existirem (necessário para evitar diff_param_bins)
        ...(paymentData.payer.first_name ? { first_name: paymentData.payer.first_name } : {}),
        ...(paymentData.payer.last_name ? { last_name: paymentData.payer.last_name } : {}),
        ...(paymentData.payer.identification
          ? {
              identification: {
                type: paymentData.payer.identification.type,
                number: paymentData.payer.identification.number.replace(/\D/g, ''), // Remover formatação
              },
            }
          : {}),
        ...(paymentData.payer.address ? { address: paymentData.payer.address } : {}),
      },
      application_fee: applicationFeeAmount, // Taxa da plataforma (R$ 0,50)
      // ✅ CRÍTICO: external_reference é obrigatório para webhook identificar o pagamento
      ...(externalReference ? { external_reference: externalReference } : {}),
      ...(paymentData.metadata ? { metadata: paymentData.metadata } : {}),
      ...(paymentData.statement_descriptor
        ? { statement_descriptor: paymentData.statement_descriptor }
        : {}),
    };
    
    // ✅ Para cartão de crédito, adicionar token, installments e issuer_id (se fornecido)
    // IMPORTANTE: Usar APENAS os valores recebidos (não alterar ou inferir)
    // ✅ CORRIGIDO: Verificar se há token (indica cartão), não apenas se payment_method_id === 'credit_card'
    // payment_method_id pode ser 'visa', 'master', 'elo', etc. (não 'credit_card')
    if (paymentData.token) {
      if (!paymentData.token) {
        throw new Error('Token do cartão é obrigatório para pagamento com cartão de crédito');
      }
      // ✅ REPASSAR token exatamente como veio (sem alteração)
      payload.token = paymentData.token;
      // ✅ REPASSAR installments se fornecido (sem alteração)
      if (paymentData.installments) {
        payload.installments = paymentData.installments;
      }
      // ✅ REPASSAR issuer_id se fornecido (sem alteração)
      if (paymentData.issuer_id) {
        payload.issuer_id = String(paymentData.issuer_id);
      }
      
      // ✅ Log detalhado para cartão (ajuda a debugar problemas específicos - objetivo: eliminar diff_param_bins)
      console.log('💳 [MP Payment] Dados específicos do cartão ANTES de criar pagamento:', {
        token: paymentData.token ? String(paymentData.token).substring(0, 10) + '...' : 'NÃO ENVIADO',
        tokenLength: String(paymentData.token || '').length,
        payment_method_id: paymentData.payment_method_id || 'NÃO ENVIADO',
        issuer_id: paymentData.issuer_id || 'NÃO ENVIADO',
        installments: paymentData.installments || 'NÃO ENVIADO',
        payerName: paymentData.payer.first_name && paymentData.payer.last_name 
          ? `${paymentData.payer.first_name} ${paymentData.payer.last_name}` 
          : 'NÃO INFORMADO',
        payerIdentification: paymentData.payer.identification 
          ? `${paymentData.payer.identification.type}: ${paymentData.payer.identification.number.substring(0, 3)}***${paymentData.payer.identification.number.substring(paymentData.payer.identification.number.length - 3)}`
          : 'NÃO INFORMADO',
        hasAddress: !!paymentData.payer.address,
        addressDetails: paymentData.payer.address ? {
          zip_code: paymentData.payer.address.zip_code,
          street_name: paymentData.payer.address.street_name?.substring(0, 20) + '...',
          street_number: paymentData.payer.address.street_number,
          city: paymentData.payer.address.city,
          federal_unit: paymentData.payer.address.federal_unit,
        } : null,
      });
    }
    
    console.log('📦 [MP Payment] Payload completo:', JSON.stringify(payload, null, 2));

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
      transaction_amount: payment.transaction_amount,
      application_fee: payment.application_fee,
      vendedor_recebe: payment.transaction_amount - (payment.application_fee || 0),
      plataforma_recebe: payment.application_fee || 0,
    });
    
    // Verificar se application_fee foi aplicado
    if (!payment.application_fee || payment.application_fee === 0) {
      console.warn('⚠️ [MP Payment] ATENÇÃO: application_fee não foi aplicado! O vendedor receberá o valor total.');
      console.warn('⚠️ [MP Payment] Verifique se a aplicação está configurada corretamente no Mercado Pago.');
    } else {
      console.log('✅ [MP Payment] application_fee aplicado corretamente:', payment.application_fee);
    }

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
      // Incluir dados do PIX se disponível
      point_of_interaction: payment.point_of_interaction,
    } as any;
  } catch (error: any) {
    console.error('❌ [MP Payment] Erro ao criar pagamento:', {
      message: error?.message,
      response: error?.response?.data,
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      cause: error?.response?.data?.cause,
    });

    // Extrair mensagem de erro mais detalhada
    const responseData = error?.response?.data || {};
    let errorMessage = 
      responseData.message ||
      responseData.error ||
      error?.message ||
      'Erro ao criar pagamento no Mercado Pago';

    // Mensagens específicas para erros comuns
    if (errorMessage.includes('MARKETPLACE fail') || errorMessage.includes('GET to API MARKETPLACE')) {
      errorMessage = 'Erro de autenticação no Marketplace. Verifique se a conta do Mercado Pago está conectada corretamente. Se o problema persistir, reconecte a conta.';
    } else if (error?.response?.status === 401) {
      errorMessage = 'Token de acesso inválido ou expirado. Reconecte a conta do Mercado Pago.';
    } else if (error?.response?.status === 403) {
      errorMessage = 'Acesso negado. Verifique se a aplicação está configurada como Marketplace no painel do Mercado Pago.';
    }

    // Adicionar detalhes do erro se disponíveis
    if (responseData.cause && Array.isArray(responseData.cause) && responseData.cause.length > 0) {
      const firstCause = responseData.cause[0];
      if (firstCause.description) {
        errorMessage += ` Detalhes: ${firstCause.description}`;
      }
    }

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
