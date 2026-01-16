/**
 * Card Payment Brick do Mercado Pago
 * 
 * Componente que encapsula o Card Payment Brick do Mercado Pago SDK v2.
 * Usa Secure Fields para PCI Compliance (SAQ-A).
 * 
 * ⚠️ IMPORTANTE: Este componente NÃO captura dados de cartão manualmente.
 * O Brick renderiza campos seguros em iframes.
 */

import { useEffect, useRef, useState } from 'react';
import { initMercadoPago, CardPayment } from '@mercadopago/sdk-react';

interface CardPaymentBrickProps {
  publicKey: string;
  amount: number; // Valor em reais (ex: 10.00)
  onSubmit: (formData: {
    token: string;
    payment_method_id: string;
    issuer_id: string;
    installments: number;
    bin?: string;
    lastFourDigits?: string;
  }) => void | Promise<void>;
  onReady?: () => void;
  onError?: (error: any) => void;
  payerData?: {
    email: string;
    identificationType: 'CPF' | 'CNPJ';
    identificationNumber: string;
    firstName?: string;
    lastName?: string;
  };
}

export const CardPaymentBrick = ({
  publicKey,
  amount,
  onSubmit,
  onReady,
  onError,
  payerData,
}: CardPaymentBrickProps) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const initializationRef = useRef(false);

  // ✅ Inicializar Mercado Pago SDK apenas uma vez
  useEffect(() => {
    if (!publicKey || initializationRef.current) return;

    try {
      initMercadoPago(publicKey, {
        locale: 'pt-BR',
      });
      initializationRef.current = true;
      setIsInitialized(true);
      console.log('✅ [MP Brick] Mercado Pago SDK inicializado');
    } catch (error) {
      console.error('❌ [MP Brick] Erro ao inicializar SDK:', error);
      onError?.(error);
    }
  }, [publicKey, onError]);

  // ✅ Handler para quando o Brick está pronto
  const handleReady = () => {
    console.log('✅ [MP Brick] Card Payment Brick está pronto');
    setIsReady(true);
    onReady?.();
  };

  // ✅ Handler para erros do Brick
  const handleError = (error: any) => {
    console.error('❌ [MP Brick] Erro no Brick:', error);
    onError?.(error);
  };

  // ✅ Handler para submit do formulário
  const handleSubmit = async (formData: any) => {
    console.log('📦 [MP Brick] Dados completos do formulário recebidos:', JSON.stringify(formData, null, 2));

    // ✅ O formData do Brick pode ter campos diferentes dependendo da região
    // Campos possíveis: token, paymentMethodId, issuerId, installments, etc.
    const token = formData.token || formData.cardToken || formData.card_token;
    const paymentMethodId = formData.paymentMethodId || formData.payment_method_id || formData.paymentMethod?.id;
    const issuerId = formData.issuerId || formData.issuer_id || formData.issuer?.id;
    const installments = formData.installments || formData.installment || 1;
    const bin = formData.bin || formData.cardBin || formData.firstSixDigits;
    const lastFourDigits = formData.lastFourDigits || formData.last_four_digits || formData.last4;

    console.log('📦 [MP Brick] Dados extraídos do formData:', {
      token: token ? String(token).substring(0, 10) + '...' : 'NÃO ENVIADO',
      payment_method_id: paymentMethodId || 'NÃO ENVIADO',
      issuer_id: issuerId || 'NÃO ENVIADO',
      installments: installments || 'NÃO ENVIADO',
      bin: bin || 'NÃO ENVIADO',
      lastFourDigits: lastFourDigits || 'NÃO ENVIADO',
    });

    // ✅ VALIDAÇÃO: Garantir que token está presente
    if (!token) {
      const error = new Error('Token do cartão não foi retornado pelo Brick');
      console.error('❌ [MP Brick]', error);
      onError?.(error);
      return;
    }

    // ✅ VALIDAÇÃO: Se payment_method_id ou issuer_id não vierem do Brick, buscar via backend
    let finalPaymentMethodId = paymentMethodId;
    let finalIssuerId = issuerId;

    if (!finalPaymentMethodId || !finalIssuerId) {
      // Se não vieram do Brick, buscar via backend usando o BIN
      if (bin && bin.length >= 6) {
        console.log('🔍 [MP Brick] payment_method_id ou issuer_id não vieram do Brick, buscando via backend...');
        try {
          const getPaymentMethodUrl = '/.netlify/functions/mercadopago-get-payment-method';
          const paymentMethodResponse = await fetch(getPaymentMethodUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bin: bin.substring(0, 6) }),
          });

          if (paymentMethodResponse.ok) {
            const paymentMethodData = await paymentMethodResponse.json();
            finalPaymentMethodId = finalPaymentMethodId || paymentMethodData.payment_method_id;
            finalIssuerId = finalIssuerId || paymentMethodData.issuer_id;
            console.log('✅ [MP Brick] Dados obtidos via backend:', {
              payment_method_id: finalPaymentMethodId,
              issuer_id: finalIssuerId,
            });
          }
        } catch (error) {
          console.warn('⚠️ [MP Brick] Erro ao buscar payment_method_id/issuer_id via backend:', error);
        }
      }
    }

    // ✅ VALIDAÇÃO FINAL: Garantir que payment_method_id e issuer_id estão presentes
    if (!finalPaymentMethodId) {
      const error = new Error('payment_method_id não foi retornado pelo Brick e não foi possível buscar via backend');
      console.error('❌ [MP Brick]', error);
      onError?.(error);
      return;
    }

    if (!finalIssuerId) {
      const error = new Error('issuer_id não foi retornado pelo Brick e não foi possível buscar via backend');
      console.error('❌ [MP Brick]', error);
      onError?.(error);
      return;
    }

    // ✅ Extrair dados do formData
    const brickData = {
      token: String(token),
      payment_method_id: String(finalPaymentMethodId),
      issuer_id: String(finalIssuerId),
      installments: Number(installments) || 1,
      bin: bin ? String(bin).substring(0, 6) : undefined,
      lastFourDigits: lastFourDigits ? String(lastFourDigits) : undefined,
    };

    console.log('✅ [MP Brick] Dados validados e prontos para enviar:', {
      token: brickData.token.substring(0, 10) + '...',
      payment_method_id: brickData.payment_method_id,
      issuer_id: brickData.issuer_id,
      installments: brickData.installments,
    });

    // ✅ Chamar callback do componente pai
    console.log('✅ [MP Brick] Chamando onSubmit do componente pai com dados validados');
    try {
      await onSubmit(brickData);
    } catch (error) {
      console.error('❌ [MP Brick] Erro ao chamar onSubmit:', error);
      onError?.(error as Error);
    }
  };

  // ✅ Não renderizar até o SDK estar inicializado
  if (!isInitialized || !publicKey) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-400">Carregando formulário de pagamento...</div>
      </div>
    );
  }

  // ✅ Preparar dados de inicialização
  // O Brick espera amount em reais (não centavos)
  const initialization: any = {
    amount: amount, // Valor em reais (ex: 10.00)
    ...(payerData
      ? {
          payer: {
            email: payerData.email,
            identification: {
              type: payerData.identificationType,
              number: payerData.identificationNumber.replace(/\D/g, ''), // Apenas dígitos
            },
            ...(payerData.firstName && payerData.lastName
              ? {
                  firstName: payerData.firstName,
                  lastName: payerData.lastName,
                }
              : {}),
          },
        }
      : {}),
  };

  // ✅ Customização do Brick (opcional)
  const customization = {
    paymentMethods: {
      creditCard: 'all',
      debitCard: 'all',
    },
    visual: {
      style: {
        theme: 'dark', // ou 'light' - ajustar conforme tema do app
      },
    },
  };

  return (
    <div className="w-full">
      <CardPayment
        initialization={initialization}
        onSubmit={handleSubmit}
        onReady={handleReady}
        onError={handleError}
        customization={customization}
      />
    </div>
  );
};
