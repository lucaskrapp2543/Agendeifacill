/**
 * Tokenização de cartão para Mercado Pago
 * 
 * Gera token do cartão usando o SDK do Mercado Pago no frontend
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
 * Tokeniza cartão usando SDK do Mercado Pago
 * 
 * @param input - Dados do cartão
 * @param publicKey - Public key do Mercado Pago
 * @returns Token do cartão e payment_method_id (bandeira)
 */
export async function tokenizeMercadoPagoCard(
  input: CardTokenInput,
  publicKey: string
): Promise<{ token: string; payment_method_id: string }> {
  // Verificar se SDK está carregado
  if (typeof window === 'undefined') {
    throw new Error('Tokenização de cartão só funciona no navegador');
  }

  // Aguardar SDK carregar (pode demorar um pouco)
  let mp: any;
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    if ((window as any).MercadoPago) {
      mp = new (window as any).MercadoPago(publicKey);
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }

  if (!mp) {
    throw new Error('SDK do Mercado Pago não está carregado. Aguarde alguns segundos e tente novamente.');
  }

  // Normalizar dados
  const cardNumber = String(input.cardNumber || '').replace(/\D/g, '');
  const expMonth = String(input.cardExpMonth || '').replace(/\D/g, '').padStart(2, '0');
  const expYear = String(input.cardExpYear || '').replace(/\D/g, '');
  const expYearFull = expYear.length === 2 ? `20${expYear}` : expYear;
  const cvv = String(input.cardCvv || '').replace(/\D/g, '');
  const holderName = String(input.cardHolderName || '').trim();
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
    // ✅ CORRIGIDO: Criar campos temporários no DOM antes de tokenizar
    // O SDK do Mercado Pago exige que campos sejam criados com mp.fields.create() antes de usar createCardToken()
    
    // Criar container temporário oculto
    const tempContainer = document.createElement('div');
    tempContainer.id = `mp-temp-container-${Date.now()}`;
    tempContainer.style.display = 'none';
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    document.body.appendChild(tempContainer);

    try {
      // Criar campos temporários com o SDK
      const cardNumberField = mp.fields.create('cardNumber', {
        placeholder: 'Número do cartão'
      }).mount(`#${tempContainer.id}`);

      const expirationDateField = mp.fields.create('expirationDate', {
        placeholder: 'MM/YY'
      }).mount(`#${tempContainer.id}`);

      const securityCodeField = mp.fields.create('securityCode', {
        placeholder: 'CVV'
      }).mount(`#${tempContainer.id}`);

      // Aguardar campos serem montados
      await new Promise(resolve => setTimeout(resolve, 500));

      // Preencher campos programaticamente (se suportado)
      // Como não podemos preencher diretamente, usamos createCardToken com os dados
      const token = await mp.fields.createCardToken({
        cardNumber: cardNumber,
        cardholderName: holderName,
        cardExpirationMonth: expMonth,
        cardExpirationYear: expYearFull.substring(2), // SDK espera 2 dígitos
        securityCode: cvv,
        identificationType: input.identificationType,
        identificationNumber: identificationNumber,
      });

      // Limpar campos temporários
      cardNumberField.unmount();
      expirationDateField.unmount();
      securityCodeField.unmount();
      document.body.removeChild(tempContainer);

      if (!token || !token.id) {
        throw new Error('Token do cartão não foi gerado pelo Mercado Pago');
      }

      // Retornar token e payment_method_id (bandeira do cartão)
      return {
        token: String(token.id),
        payment_method_id: token.payment_method_id || 'visa', // Bandeira detectada pelo SDK
      };
    } catch (createError: any) {
      // Limpar container em caso de erro
      try {
        if (tempContainer.parentNode) {
          document.body.removeChild(tempContainer);
        }
      } catch {}
      throw createError;
    }
  } catch (error: any) {
    console.error('❌ Erro ao tokenizar cartão Mercado Pago:', error);
    const errorMessage = error?.message || error?.error || 'Erro ao tokenizar cartão';
    throw new Error(errorMessage);
  }
}
