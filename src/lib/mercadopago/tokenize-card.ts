/**
 * Tokenização de cartão para Mercado Pago
 * 
 * ✅ CORRIGIDO: Usa API REST diretamente (não SDK de campos)
 * Similar ao Pagar.me, evita problemas com campos não preenchidos
 */

interface CardTokenInput {
  cardNumber: string;
  cardHolderName: string;
  cardExpMonth: string;
  cardExpYear: string;
  cardCvv: string;
  identificationType: 'CPF' | 'CNPJ';
  identificationNumber: string;
}

/**
 * Tokeniza cartão usando API REST do Mercado Pago
 * 
 * ⚠️ Esta função roda no FRONTEND. Usa public key (não secret key).
 * 
 * @param input - Dados do cartão
 * @param publicKey - Public key do Mercado Pago (APP_USR-...)
 * @returns Token do cartão e dados do método de pagamento retornados pela API
 */
export interface TokenizeCardResult {
  token: string;
  payment_method_id: string; // ✅ OBRIGATÓRIO: Deve vir da API de métodos de pagamento
  issuer_id: string; // ✅ OBRIGATÓRIO: Deve vir da API de issuers
  first_six_digits: string; // BIN do cartão (obrigatório para buscar payment_method_id e issuer_id)
}

export async function tokenizeMercadoPagoCard(
  input: CardTokenInput,
  publicKey: string
): Promise<TokenizeCardResult> {
  // Verificar se está no navegador
  if (typeof window === 'undefined') {
    throw new Error('Tokenização de cartão só funciona no navegador');
  }

  // Validar public key
  if (!publicKey || !publicKey.trim()) {
    throw new Error('Chave pública do Mercado Pago não configurada');
  }

  // Normalizar dados
  const cardNumber = String(input.cardNumber || '').replace(/\D/g, '');
  const expMonth = String(input.cardExpMonth || '').replace(/\D/g, '').padStart(2, '0');
  const expYear = String(input.cardExpYear || '').replace(/\D/g, '');
  const expYearFull = expYear.length === 2 ? `20${expYear}` : expYear;
  const expYearShort = expYearFull.substring(2); // SDK espera 2 dígitos (YY)
  const cvv = String(input.cardCvv || '').replace(/\D/g, '');
  const holderName = String(input.cardHolderName || '').trim().toUpperCase();
  const identificationNumber = String(input.identificationNumber || '').replace(/\D/g, '');

  // Validações
  if (cardNumber.length < 13 || cardNumber.length > 19) {
    throw new Error('Número do cartão inválido');
  }
  if (!expMonth || expMonth.length !== 2 || Number(expMonth) < 1 || Number(expMonth) > 12) {
    throw new Error('Mês de validade inválido');
  }
  if (!expYearFull || expYearFull.length !== 4) {
    throw new Error('Ano de validade inválido');
  }
  if (cvv.length < 3 || cvv.length > 4) {
    throw new Error('CVV inválido');
  }
  if (!holderName) {
    throw new Error('Nome do titular é obrigatório');
  }
  if (!identificationNumber || (identificationNumber.length !== 11 && identificationNumber.length !== 14)) {
    throw new Error('CPF/CNPJ inválido');
  }

  try {
    // ✅ USAR API REST DIRETAMENTE (similar ao Pagar.me)
    // Endpoint: POST https://api.mercadopago.com/v1/card_tokens
    // ⚠️ IMPORTANTE: public_key deve ser enviado como QUERY PARAMETER, não no body
    const url = `https://api.mercadopago.com/v1/card_tokens?public_key=${encodeURIComponent(publicKey)}`;

    const payload: any = {
      card_number: cardNumber,
      cardholder_name: holderName,
      card_expiration_month: expMonth,
      card_expiration_year: expYearShort, // 2 dígitos (YY)
      security_code: cvv,
      identification_type: input.identificationType,
      identification_number: identificationNumber,
    };

    console.log('🔄 [MP Tokenize] Criando token via API REST...', {
      cardNumber: cardNumber.substring(0, 6) + '****' + cardNumber.substring(cardNumber.length - 4),
      holderName,
      expMonth,
      expYear: expYearShort,
      publicKey: publicKey.substring(0, 10) + '...',
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg =
        data?.message ||
        data?.error ||
        (data?.cause && Array.isArray(data.cause) ? data.cause[0]?.description : null) ||
        `Erro ${response.status} ao tokenizar cartão`;
      throw new Error(String(errorMsg));
    }

    // Validar resposta
    if (!data?.id) {
      throw new Error('Token do cartão não foi retornado pelo Mercado Pago');
    }

    // ✅ OBRIGATÓRIO: Obter BIN (first_six_digits) da resposta
    const bin = data?.first_six_digits || cardNumber.substring(0, 6);
    if (!bin || bin.length < 6) {
      throw new Error('BIN do cartão não foi retornado e não pode ser inferido');
    }

    const token = String(data.id);

    // ✅ CRÍTICO: Buscar payment_method_id e issuer_id usando a API do Mercado Pago com o BIN
    // A API de tokenização NÃO retorna esses dados, precisamos buscar separadamente
    console.log('🔍 [MP Tokenize] Buscando payment_method_id e issuer_id para BIN:', bin);

    let payment_method_id: string | undefined;
    let issuer_id: string | undefined;

    try {
      // 1. Buscar payment_method_id usando BIN
      // Endpoint: GET https://api.mercadopago.com/v1/payment_methods?bin={bin}
      const paymentMethodsUrl = `https://api.mercadopago.com/v1/payment_methods?bin=${bin}`;
      const paymentMethodsResponse = await fetch(paymentMethodsUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (paymentMethodsResponse.ok) {
        const paymentMethodsData = await paymentMethodsResponse.json().catch(() => ({}));
        
        // Pegar o primeiro payment method (geralmente é o correto para o BIN)
        if (paymentMethodsData?.results && Array.isArray(paymentMethodsData.results) && paymentMethodsData.results.length > 0) {
          payment_method_id = paymentMethodsData.results[0]?.id;
          console.log('✅ [MP Tokenize] payment_method_id encontrado:', payment_method_id);
        }
      }

      // 2. Se encontrou payment_method_id, buscar issuer_id
      if (payment_method_id) {
        // Endpoint: GET https://api.mercadopago.com/v1/payment_methods/{payment_method_id}/issuers?bin={bin}
        const issuersUrl = `https://api.mercadopago.com/v1/payment_methods/${payment_method_id}/issuers?bin=${bin}`;
        const issuersResponse = await fetch(issuersUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        });

        if (issuersResponse.ok) {
          const issuersData = await issuersResponse.json().catch(() => ({}));
          
          // Pegar o primeiro issuer (geralmente é o correto para o BIN)
          if (issuersData && Array.isArray(issuersData) && issuersData.length > 0) {
            issuer_id = issuersData[0]?.id;
            console.log('✅ [MP Tokenize] issuer_id encontrado:', issuer_id);
          }
        }
      }
    } catch (apiError: any) {
      console.error('⚠️ [MP Tokenize] Erro ao buscar payment_method_id/issuer_id:', apiError);
      // Continuar e validar depois se estão presentes
    }

    // ✅ VALIDAÇÃO CRÍTICA: Se payment_method_id ou issuer_id não foram encontrados, ERRO
    if (!payment_method_id) {
      throw new Error('Não foi possível determinar o método de pagamento (payment_method_id) para este cartão. Verifique o número do cartão.');
    }

    if (!issuer_id) {
      throw new Error('Não foi possível determinar o banco emissor (issuer_id) para este cartão. Verifique o número do cartão.');
    }

    const result: TokenizeCardResult = {
      token,
      first_six_digits: bin,
      payment_method_id, // ✅ OBRIGATÓRIO
      issuer_id, // ✅ OBRIGATÓRIO
    };

    console.log('✅ [MP Tokenize] Token criado - Dados completos:', {
      token: token.substring(0, 10) + '...',
      first_six_digits: result.first_six_digits,
      payment_method_id: result.payment_method_id,
      issuer_id: result.issuer_id,
    });

    return result;
  } catch (error: any) {
    console.error('❌ Erro ao tokenizar cartão Mercado Pago:', error);
    const errorMessage = error?.message || error?.error || 'Erro ao tokenizar cartão';
    throw new Error(errorMessage);
  }
}
