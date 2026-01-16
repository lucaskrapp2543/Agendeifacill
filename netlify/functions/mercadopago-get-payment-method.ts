import type { Handler } from '@netlify/functions';
import { json, parseJsonBody } from './_utils';

/**
 * Netlify Function para buscar payment_method_id e issuer_id do Mercado Pago
 * usando o BIN (primeiros 6 dígitos) do cartão.
 * 
 * Esta função roda no BACKEND para evitar problemas de CORS ao chamar
 * a API do Mercado Pago diretamente do frontend.
 * 
 * Endpoint: POST /.netlify/functions/mercadopago-get-payment-method
 * Body: { bin: string }
 * Response: { payment_method_id: string, issuer_id: string }
 */

const MP_API_BASE_URL = 'https://api.mercadopago.com';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' }, { Allow: 'POST' });
  }

  try {
    // ✅ OBRIGATÓRIO: Obter access_token do ambiente Netlify
    const accessToken = String(process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim();

    if (!accessToken) {
      console.error('❌ [MP Get Payment Method] MERCADOPAGO_ACCESS_TOKEN não configurado');
      return json(500, {
        error: 'Configuração faltando',
        message: 'A variável de ambiente MERCADOPAGO_ACCESS_TOKEN não está configurada no Netlify.',
      });
    }

    // ✅ DETECTAR AMBIENTE: Verificar se é TESTE ou PRODUÇÃO
    // Tokens de teste começam com "TEST-", tokens de produção começam com "APP_USR-"
    const isTestEnvironment = accessToken.startsWith('TEST-');
    const environment = isTestEnvironment ? 'TESTE' : 'PRODUÇÃO';
    
    console.log('🔍 [MP Get Payment Method] Ambiente detectado:', environment);
    console.log('🔍 [MP Get Payment Method] Access Token (primeiros 10 chars):', accessToken.substring(0, 10) + '...');

    const body = parseJsonBody<{ bin: string }>(event);
    
    if (!body?.bin) {
      return json(400, {
        error: 'BIN é obrigatório',
        message: 'O campo "bin" (primeiros 6 dígitos do cartão) é obrigatório.',
      });
    }

    const bin = String(body.bin).replace(/\D/g, '');

    if (bin.length < 6) {
      return json(400, {
        error: 'BIN inválido',
        message: 'O BIN deve ter pelo menos 6 dígitos.',
      });
    }

    // ✅ LOG EXPLÍCITO: BIN recebido
    console.log('🔍 [MP Get Payment Method] BIN recebido:', bin);
    console.log('🔍 [MP Get Payment Method] Ambiente:', environment);

    let payment_method_id: string | undefined;
    let issuer_id: string | undefined;

    try {
      // 1. Buscar payment_method_id usando BIN
      // Endpoint: GET https://api.mercadopago.com/v1/payment_methods?bin={bin}
      // ✅ Adicionar Authorization Bearer header
      const paymentMethodsUrl = `${MP_API_BASE_URL}/v1/payment_methods?bin=${bin}`;
      const paymentMethodsResponse = await fetch(paymentMethodsUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${accessToken}`, // ✅ OBRIGATÓRIO: Autenticação com access_token
        },
      });

      if (!paymentMethodsResponse.ok) {
        const errorData = await paymentMethodsResponse.json().catch(() => ({}));
        console.error('❌ [MP Get Payment Method] Erro ao buscar payment_methods:', {
          status: paymentMethodsResponse.status,
          statusText: paymentMethodsResponse.statusText,
          error: errorData,
          bin: bin,
          environment: environment,
        });
        return json(500, {
          error: 'Erro ao buscar método de pagamento',
          message: `Não foi possível buscar o método de pagamento para este BIN. Erro: ${paymentMethodsResponse.status} ${paymentMethodsResponse.statusText}`,
        });
      }

      const paymentMethodsData = await paymentMethodsResponse.json().catch(() => ({}));
      
      // ✅ LOG EXPLÍCITO: Resposta completa da API do Mercado Pago
      console.log('📥 [MP Get Payment Method] Resposta completa da API payment_methods:', JSON.stringify(paymentMethodsData, null, 2));
      
      // Pegar o primeiro payment method (geralmente é o correto para o BIN)
      if (paymentMethodsData?.results && Array.isArray(paymentMethodsData.results) && paymentMethodsData.results.length > 0) {
        payment_method_id = paymentMethodsData.results[0]?.id;
        // ✅ LOG EXPLÍCITO: payment_method_id retornado pelo Mercado Pago
        console.log('✅ [MP Get Payment Method] payment_method_id retornado pelo Mercado Pago:', payment_method_id);
        console.log('✅ [MP Get Payment Method] Dados completos do payment method:', JSON.stringify(paymentMethodsData.results[0], null, 2));
      } else {
        // ✅ LOG EXPLÍCITO: Nenhum payment_method encontrado
        console.warn('⚠️ [MP Get Payment Method] Nenhum payment_method encontrado para BIN:', bin);
        console.warn('⚠️ [MP Get Payment Method] Resposta da API:', JSON.stringify(paymentMethodsData, null, 2));
        console.warn('⚠️ [MP Get Payment Method] Ambiente:', environment);
        
        // ✅ ERRO CLARO: Informar se é problema de ambiente (teste/produção)
        const errorMessage = isTestEnvironment
          ? 'Cartão inválido para este ambiente (TESTE). Use apenas cartões de teste do Mercado Pago.'
          : 'Cartão inválido para este ambiente (PRODUÇÃO). Este cartão pode ser apenas para teste.';
        
        return json(404, {
          error: 'Método de pagamento não encontrado',
          message: errorMessage,
          environment: environment,
          bin: bin.substring(0, 2) + '****',
        });
      }

      // 2. Se encontrou payment_method_id, buscar issuer_id
      if (payment_method_id) {
        // Endpoint: GET https://api.mercadopago.com/v1/payment_methods/{payment_method_id}/issuers?bin={bin}
        // ✅ Adicionar Authorization Bearer header
        const issuersUrl = `${MP_API_BASE_URL}/v1/payment_methods/${payment_method_id}/issuers?bin=${bin}`;
        const issuersResponse = await fetch(issuersUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${accessToken}`, // ✅ OBRIGATÓRIO: Autenticação com access_token
          },
        });

        if (!issuersResponse.ok) {
          const errorData = await issuersResponse.json().catch(() => ({}));
          console.error('❌ [MP Get Payment Method] Erro ao buscar issuers:', {
            status: issuersResponse.status,
            statusText: issuersResponse.statusText,
            error: errorData,
            payment_method_id: payment_method_id,
            bin: bin,
            environment: environment,
          });
          // ✅ LOG EXPLÍCITO: Resposta completa quando falhar
          console.error('❌ [MP Get Payment Method] Resposta completa da API issuers (erro):', JSON.stringify(errorData, null, 2));
          return json(500, {
            error: 'Erro ao buscar banco emissor',
            message: `Não foi possível buscar o banco emissor para este cartão. Erro: ${issuersResponse.status} ${issuersResponse.statusText}`,
          });
        }

        const issuersData = await issuersResponse.json().catch(() => ({}));
        
        // ✅ LOG EXPLÍCITO: Resposta completa da API issuers
        console.log('📥 [MP Get Payment Method] Resposta completa da API issuers:', JSON.stringify(issuersData, null, 2));
        
        // Pegar o primeiro issuer (geralmente é o correto para o BIN)
        if (issuersData && Array.isArray(issuersData) && issuersData.length > 0) {
          issuer_id = String(issuersData[0]?.id || issuersData[0]?.id || '');
          // ✅ LOG EXPLÍCITO: issuer_id retornado
          console.log('✅ [MP Get Payment Method] issuer_id retornado pelo Mercado Pago:', issuer_id);
          console.log('✅ [MP Get Payment Method] Dados completos do issuer:', JSON.stringify(issuersData[0], null, 2));
        } else {
          console.warn('⚠️ [MP Get Payment Method] Nenhum issuer encontrado para payment_method_id:', payment_method_id);
          console.warn('⚠️ [MP Get Payment Method] Resposta da API issuers:', JSON.stringify(issuersData, null, 2));
          console.warn('⚠️ [MP Get Payment Method] Ambiente:', environment);
          
          // ✅ ERRO CLARO: Informar se é problema de ambiente
          const errorMessage = isTestEnvironment
            ? 'Cartão inválido para este ambiente (TESTE). Use apenas cartões de teste do Mercado Pago.'
            : 'Cartão inválido para este ambiente (PRODUÇÃO). Este cartão pode ser apenas para teste.';
          
          return json(404, {
            error: 'Banco emissor não encontrado',
            message: errorMessage,
            environment: environment,
            bin: bin.substring(0, 2) + '****',
          });
        }
      }

      // ✅ VALIDAÇÃO: Se payment_method_id ou issuer_id não foram encontrados, ERRO
      if (!payment_method_id) {
        return json(404, {
          error: 'Método de pagamento não encontrado',
          message: 'Não foi possível determinar o método de pagamento (payment_method_id) para este cartão.',
        });
      }

      if (!issuer_id) {
        return json(404, {
          error: 'Banco emissor não encontrado',
          message: 'Não foi possível determinar o banco emissor (issuer_id) para este cartão.',
        });
      }

      // ✅ LOG EXPLÍCITO: Resumo final com todos os dados
      console.log('✅ [MP Get Payment Method] Sucesso - Resumo:', {
        bin: bin,
        environment: environment,
        payment_method_id: payment_method_id,
        issuer_id: issuer_id,
      });

      // ✅ GARANTIR: payment_method_id e issuer_id vêm EXCLUSIVAMENTE da API (não hardcoded)
      if (!payment_method_id || !issuer_id) {
        console.error('❌ [MP Get Payment Method] ERRO CRÍTICO: payment_method_id ou issuer_id não foram retornados pela API');
        return json(500, {
          error: 'Dados incompletos da API',
          message: 'O Mercado Pago não retornou payment_method_id ou issuer_id para este cartão.',
          environment: environment,
        });
      }

      return json(200, {
        payment_method_id,
        issuer_id,
        bin: bin.substring(0, 6), // Retornar BIN normalizado
        environment: environment, // Informar ambiente para debug
      });
    } catch (apiError: any) {
      // ✅ LOG EXPLÍCITO: Erro completo quando falhar
      console.error('❌ [MP Get Payment Method] Erro ao buscar dados:', {
        error: apiError,
        message: apiError?.message,
        stack: apiError?.stack,
        bin: bin,
        environment: environment,
      });
      return json(500, {
        error: 'Erro ao buscar dados do cartão',
        message: apiError?.message || 'Erro desconhecido ao buscar payment_method_id e issuer_id.',
        environment: environment,
      });
    }
  } catch (error: any) {
    console.error('❌ [MP Get Payment Method] Erro geral:', error);
    return json(500, {
      error: error?.message || 'Erro ao processar requisição',
    });
  }
};
