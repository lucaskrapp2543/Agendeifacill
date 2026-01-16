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

    console.log('🔍 [MP Get Payment Method] Buscando payment_method_id e issuer_id para BIN:', bin.substring(0, 2) + '****');

    let payment_method_id: string | undefined;
    let issuer_id: string | undefined;

    try {
      // 1. Buscar payment_method_id usando BIN
      // Endpoint: GET https://api.mercadopago.com/v1/payment_methods?bin={bin}
      const paymentMethodsUrl = `${MP_API_BASE_URL}/v1/payment_methods?bin=${bin}`;
      const paymentMethodsResponse = await fetch(paymentMethodsUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (!paymentMethodsResponse.ok) {
        const errorData = await paymentMethodsResponse.json().catch(() => ({}));
        console.error('❌ [MP Get Payment Method] Erro ao buscar payment_methods:', {
          status: paymentMethodsResponse.status,
          statusText: paymentMethodsResponse.statusText,
          error: errorData,
        });
        return json(500, {
          error: 'Erro ao buscar método de pagamento',
          message: `Não foi possível buscar o método de pagamento para este BIN. Erro: ${paymentMethodsResponse.status} ${paymentMethodsResponse.statusText}`,
        });
      }

      const paymentMethodsData = await paymentMethodsResponse.json().catch(() => ({}));
      
      // Pegar o primeiro payment method (geralmente é o correto para o BIN)
      if (paymentMethodsData?.results && Array.isArray(paymentMethodsData.results) && paymentMethodsData.results.length > 0) {
        payment_method_id = paymentMethodsData.results[0]?.id;
        console.log('✅ [MP Get Payment Method] payment_method_id encontrado:', payment_method_id);
      } else {
        console.warn('⚠️ [MP Get Payment Method] Nenhum payment_method encontrado para BIN:', bin.substring(0, 2) + '****');
        return json(404, {
          error: 'Método de pagamento não encontrado',
          message: 'Não foi possível determinar o método de pagamento para este cartão. Verifique o número do cartão.',
        });
      }

      // 2. Se encontrou payment_method_id, buscar issuer_id
      if (payment_method_id) {
        // Endpoint: GET https://api.mercadopago.com/v1/payment_methods/{payment_method_id}/issuers?bin={bin}
        const issuersUrl = `${MP_API_BASE_URL}/v1/payment_methods/${payment_method_id}/issuers?bin=${bin}`;
        const issuersResponse = await fetch(issuersUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        });

        if (!issuersResponse.ok) {
          const errorData = await issuersResponse.json().catch(() => ({}));
          console.error('❌ [MP Get Payment Method] Erro ao buscar issuers:', {
            status: issuersResponse.status,
            statusText: issuersResponse.statusText,
            error: errorData,
          });
          return json(500, {
            error: 'Erro ao buscar banco emissor',
            message: `Não foi possível buscar o banco emissor para este cartão. Erro: ${issuersResponse.status} ${issuersResponse.statusText}`,
          });
        }

        const issuersData = await issuersResponse.json().catch(() => ({}));
        
        // Pegar o primeiro issuer (geralmente é o correto para o BIN)
        if (issuersData && Array.isArray(issuersData) && issuersData.length > 0) {
          issuer_id = String(issuersData[0]?.id || issuersData[0]?.id || '');
          console.log('✅ [MP Get Payment Method] issuer_id encontrado:', issuer_id);
        } else {
          console.warn('⚠️ [MP Get Payment Method] Nenhum issuer encontrado para payment_method_id:', payment_method_id);
          return json(404, {
            error: 'Banco emissor não encontrado',
            message: 'Não foi possível determinar o banco emissor para este cartão. Verifique o número do cartão.',
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

      console.log('✅ [MP Get Payment Method] Sucesso:', {
        payment_method_id,
        issuer_id,
        bin: bin.substring(0, 2) + '****',
      });

      return json(200, {
        payment_method_id,
        issuer_id,
        bin: bin.substring(0, 6), // Retornar BIN normalizado
      });
    } catch (apiError: any) {
      console.error('❌ [MP Get Payment Method] Erro ao buscar dados:', apiError);
      return json(500, {
        error: 'Erro ao buscar dados do cartão',
        message: apiError?.message || 'Erro desconhecido ao buscar payment_method_id e issuer_id.',
      });
    }
  } catch (error: any) {
    console.error('❌ [MP Get Payment Method] Erro geral:', error);
    return json(500, {
      error: error?.message || 'Erro ao processar requisição',
    });
  }
};
