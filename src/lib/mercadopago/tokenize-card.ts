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
  payment_method_id?: string; // Pode não vir na resposta, mas inferimos do BIN
  issuer_id?: string; // Pode não vir na resposta
  first_six_digits?: string; // BIN do cartão
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

    // ✅ IMPORTANTE: Capturar TODOS os dados retornados pela API (sem fallback hardcoded)
    // A resposta pode incluir payment_method, issuer_id, first_six_digits, etc.
    const result: TokenizeCardResult = {
      token: String(data.id),
      first_six_digits: data?.first_six_digits || undefined,
      payment_method_id: data?.payment_method?.id || undefined, // Se vier na resposta, usar
      issuer_id: data?.issuer?.id || data?.issuer_id || undefined, // Se vier na resposta, usar
    };

    // ⚠️ Se payment_method_id não vier na resposta, NÃO usar fallback hardcoded
    // Deixar undefined e o frontend deve detectar isso e tratar adequadamente
    // O Mercado Pago pode inferir do token na hora do pagamento se necessário

    console.log('✅ [MP Tokenize] Token criado - Dados retornados pela API:', {
      token: String(data.id).substring(0, 10) + '...',
      first_six_digits: result.first_six_digits,
      payment_method_id: result.payment_method_id || 'NÃO RETORNADO (será inferido)',
      issuer_id: result.issuer_id || 'NÃO RETORNADO',
      rawResponse: {
        hasPaymentMethod: !!data?.payment_method,
        hasIssuer: !!data?.issuer || !!data?.issuer_id,
        hasFirstSixDigits: !!data?.first_six_digits,
      },
    });

    return result;
  } catch (error: any) {
    console.error('❌ Erro ao tokenizar cartão Mercado Pago:', error);
    const errorMessage = error?.message || error?.error || 'Erro ao tokenizar cartão';
    throw new Error(errorMessage);
  }
}
