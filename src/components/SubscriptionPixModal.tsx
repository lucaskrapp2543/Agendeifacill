import { CheckCircle2, CreditCard, Loader2, MessageCircle, QrCode, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { criarTokenCartaoPagarme } from '../lib/pagarmeTokenize';
import { CardPaymentBrick } from './CardPaymentBrick';
import { supabase } from '../lib/supabase';

type SubscriptionPixModalProps = {
  isOpen: boolean;
  onClose: () => void;
  establishmentId: string;
  recipientId?: string; // Opcional se usar Mercado Pago
  establishmentName: string;
  establishmentWhatsapp?: string | null;
  subscription: {
    id: string;
    name: string;
    value: number; // em reais (como vem do banco)
    duration_months?: number | null;
  };
  paymentProvider?: 'pagarme' | 'mercadopago'; // Novo prop para indicar qual gateway usar
};

export const SubscriptionPixModal: React.FC<SubscriptionPixModalProps> = ({
  isOpen,
  onClose,
  establishmentId,
  recipientId,
  establishmentName,
  establishmentWhatsapp,
  subscription,
  paymentProvider = 'pagarme', // Padrão: Pagar.me
}) => {
  const [selectedMethod, setSelectedMethod] = useState<'pix' | 'credit_card' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [pixQrCode, setPixQrCode] = useState('');
  const [pixQrCodeUrl, setPixQrCodeUrl] = useState('');
  const [isPaid, setIsPaid] = useState(false);
  const [currentPaymentId, setCurrentPaymentId] = useState<string>('');
  const [currentPaymentProvider, setCurrentPaymentProvider] = useState<'pagarme_pix' | 'pagarme_card' | 'mercadopago_pix' | 'mercadopago_card' | ''>('');
  const [lastCheckError, setLastCheckError] = useState<string>('');
  const [cpf, setCpf] = useState('');
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolderName, setCardHolderName] = useState('');
  const [cardExpMonth, setCardExpMonth] = useState('');
  const [cardExpYear, setCardExpYear] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [billingCep, setBillingCep] = useState('');
  const [billingRua, setBillingRua] = useState('');
  const [billingNumero, setBillingNumero] = useState('');
  const [billingBairro, setBillingBairro] = useState('');
  const [billingCidade, setBillingCidade] = useState('');
  const [billingUf, setBillingUf] = useState('');
  const [cardRefusedReason, setCardRefusedReason] = useState('');
  const countdownRef = useRef<number | null>(null);
  const statusIntervalRef = useRef<number | null>(null);
  const [expiresInSeconds, setExpiresInSeconds] = useState(90);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  // ✅ NOVO: Estados para verificar Mercado Pago e dados do Brick
  const [hasMercadoPago, setHasMercadoPago] = useState(false);
  const [brickCardToken, setBrickCardToken] = useState<string | null>(null);
  const [brickPaymentMethodId, setBrickPaymentMethodId] = useState<string | null>(null);
  const [brickIssuerId, setBrickIssuerId] = useState<string | null>(null);
  const [brickInstallments, setBrickInstallments] = useState<number>(1);
  const [isBrickReady, setIsBrickReady] = useState(false);

  // ✅ NOVO: Carregar dados salvos do endereço e email ao abrir o modal
  useEffect(() => {
    if (isOpen && establishmentId) {
      try {
        const savedBillingCep = localStorage.getItem(`subscription_billing_cep_${establishmentId}`);
        const savedBillingRua = localStorage.getItem(`subscription_billing_rua_${establishmentId}`);
        const savedBillingNumero = localStorage.getItem(`subscription_billing_numero_${establishmentId}`);
        const savedBillingBairro = localStorage.getItem(`subscription_billing_bairro_${establishmentId}`);
        const savedBillingCidade = localStorage.getItem(`subscription_billing_cidade_${establishmentId}`);
        const savedBillingUf = localStorage.getItem(`subscription_billing_uf_${establishmentId}`);
        const savedEmail = localStorage.getItem(`subscription_email_${establishmentId}`);
        
        if (savedBillingCep && !billingCep) setBillingCep(savedBillingCep);
        if (savedBillingRua && !billingRua) setBillingRua(savedBillingRua);
        if (savedBillingNumero && !billingNumero) setBillingNumero(savedBillingNumero);
        if (savedBillingBairro && !billingBairro) setBillingBairro(savedBillingBairro);
        if (savedBillingCidade && !billingCidade) setBillingCidade(savedBillingCidade);
        if (savedBillingUf && !billingUf) setBillingUf(savedBillingUf);
        if (savedEmail && !email) {
          // Só usar se não for email de guest
          if (!savedEmail.includes('guest_') && !savedEmail.includes('@agendafaci')) {
            setEmail(savedEmail);
          }
        }
      } catch (e) {
        console.warn('⚠️ Erro ao carregar dados salvos:', e);
      }
    }
  }, [isOpen, establishmentId]);

  // ✅ Salvar dados do endereço e email quando mudarem
  useEffect(() => {
    if (isOpen && establishmentId) {
      try {
        if (billingCep) localStorage.setItem(`subscription_billing_cep_${establishmentId}`, billingCep);
        if (billingRua) localStorage.setItem(`subscription_billing_rua_${establishmentId}`, billingRua);
        if (billingNumero) localStorage.setItem(`subscription_billing_numero_${establishmentId}`, billingNumero);
        if (billingBairro) localStorage.setItem(`subscription_billing_bairro_${establishmentId}`, billingBairro);
        if (billingCidade) localStorage.setItem(`subscription_billing_cidade_${establishmentId}`, billingCidade);
        if (billingUf) localStorage.setItem(`subscription_billing_uf_${establishmentId}`, billingUf);
        if (email && !email.includes('guest_') && !email.includes('@agendafaci')) {
          localStorage.setItem(`subscription_email_${establishmentId}`, email);
        }
      } catch (e) {
        console.warn('⚠️ Erro ao salvar dados:', e);
      }
    }
  }, [isOpen, establishmentId, billingCep, billingRua, billingNumero, billingBairro, billingCidade, billingUf, email]);

  const amountInCents = Math.round(Number(subscription.value || 0) * 100);

  // ✅ NOVO: Verificar se Mercado Pago está configurado (similar ao PaymentModal)
  useEffect(() => {
    if (isOpen && establishmentId) {
      supabase
        .from('establishments')
        .select('mercadopago_access_token, use_mercadopago_subscription_pix')
        .eq('id', establishmentId)
        .single()
        .then(({ data }) => {
          const hasMPToken = !!data?.mercadopago_access_token;
          const useMPSubscription = Boolean(data?.use_mercadopago_subscription_pix === true);
          // Se paymentProvider é 'mercadopago' E tem token E está habilitado → usar Mercado Pago
          setHasMercadoPago(
            paymentProvider === 'mercadopago' && hasMPToken && useMPSubscription
          );
        })
        .catch(() => {
          setHasMercadoPago(paymentProvider === 'mercadopago');
        });
    }
  }, [isOpen, establishmentId, paymentProvider]);

  useEffect(() => {
    if (!isOpen) return;
    // reset básico ao abrir
    setSelectedMethod(null);
    setIsProcessing(false);
    setIsCheckingPayment(false);
    setPixQrCode('');
    setPixQrCodeUrl('');
    setIsPaid(false);
    setCurrentPaymentId('');
    setCurrentPaymentProvider('');
    setLastCheckError('');
    setExpiresInSeconds(90);
    setRemainingSeconds(0);
    setCardRefusedReason('');
    setBrickCardToken(null);
    setBrickPaymentMethodId(null);
    setBrickIssuerId(null);
    setBrickInstallments(1);
    setIsBrickReady(false);
  }, [isOpen]);

  useEffect(() => {
    if (countdownRef.current) {
      window.clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    if (!pixQrCode || !isCheckingPayment || remainingSeconds <= 0) return;

    countdownRef.current = window.setInterval(() => {
      setRemainingSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      if (countdownRef.current) {
        window.clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [pixQrCode, isCheckingPayment, remainingSeconds]);

  // Se o tempo do PIX zerar, parar verificação para não ficar preso na tela
  useEffect(() => {
    if (remainingSeconds > 0) return;
    if (statusIntervalRef.current) {
      window.clearInterval(statusIntervalRef.current);
      statusIntervalRef.current = null;
    }
    if (isCheckingPayment) {
      setIsCheckingPayment(false);
    }
  }, [remainingSeconds, isCheckingPayment]);

  const formatMMSS = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const confirmSubscription = async (
    orderId: string,
    provider: 'pagarme_pix' | 'pagarme_card' | 'mercadopago_pix' | 'mercadopago_card'
  ) => {
    const confirmUrl = import.meta.env.PROD ? '/.netlify/functions/subscription-confirm-pix' : '/api/subscribers/confirm-subscription-pix';
    const resp = await fetch(confirmUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId,
        establishmentId,
        subscriptionId: subscription.id,
        provider,
        customer: {
          name: nome.trim(),
          whatsapp: whatsapp,
          email: email?.trim() || undefined,
          document: String(cpf || '').replace(/\D/g, ''),
        },
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      const msg = err?.error || `Erro ${resp.status}`;
      const detailsMsg =
        typeof err?.details === 'string'
          ? err.details
          : err?.details?.message || err?.details?.hint || err?.details?.code || '';
      throw new Error(detailsMsg ? `${msg} (${detailsMsg})` : msg);
    }

    return await resp.json().catch(() => ({}));
  };

  const checkPaymentStatusOnce = async (
    orderId: string,
    provider: 'pagarme_pix' | 'pagarme_card' | 'mercadopago_pix' | 'mercadopago_card'
  ): Promise<{ normalized: string; reason?: string }> => {
    let status = '';
    let reason: string | undefined;

    if (provider.startsWith('mercadopago_')) {
      const checkStatusUrl = import.meta.env.PROD
        ? `/.netlify/functions/mercadopago-check-status?paymentId=${orderId}`
        : `/api/mercadopago/check-status?paymentId=${orderId}`;
      const r = await fetch(checkStatusUrl);
      if (!r.ok) throw new Error('Erro ao verificar status');
      const data = await r.json();
      status = data.status || '';
      reason = data.status_detail || undefined;
    } else {
      const checkStatusUrl = import.meta.env.PROD
        ? `/.netlify/functions/pagarme-check-status?orderId=${orderId}`
        : `/api/pagarme/check-status?orderId=${orderId}`;
      const r = await fetch(checkStatusUrl);
      if (!r.ok) throw new Error('Erro ao verificar status');
      const result = await r.json();
      status = result.status || '';
      reason = result.reason || undefined;
    }

    return { normalized: String(status || '').toLowerCase(), reason };
  };

  const checkPaymentStatusPeriodically = async (
    orderId: string,
    provider: 'pagarme_pix' | 'pagarme_card' | 'mercadopago_pix' | 'mercadopago_card'
  ) => {
    const maxAttempts = 60;
    let attempts = 0;

    if (statusIntervalRef.current) {
      window.clearInterval(statusIntervalRef.current);
      statusIntervalRef.current = null;
    }

    statusIntervalRef.current = window.setInterval(async () => {
      attempts++;
      try {
        const { normalized, reason } = await checkPaymentStatusOnce(orderId, provider);
        setLastCheckError('');

        if (normalized === 'paid' || normalized === 'authorized' || normalized === 'approved') {
          if (statusIntervalRef.current) {
            window.clearInterval(statusIntervalRef.current);
            statusIntervalRef.current = null;
          }
          setIsCheckingPayment(false);
          try {
            const successData = await confirmSubscription(orderId, provider);
            console.log('✅ Assinatura registrada com sucesso:', successData);
            toast.success('Assinatura registrada! Você já aparece em "Meus Assinantes" do barbeiro.');
          } catch (e: any) {
            console.error('❌ Erro ao registrar assinatura:', e);
            // ✅ NÃO prender o usuário: marcar como pago e permitir fechar/reverificar depois.
            toast.error(`Pagamento confirmado, mas falhou registrar no sistema: ${e?.message || 'erro'}`);
          }

          setIsPaid(true);
        } else if (
          normalized === 'refused' ||
          normalized === 'rejected' ||
          normalized === 'pending_refund' ||
          normalized === 'failed' ||
          normalized === 'canceled' ||
          normalized === 'cancelled' ||
          normalized === 'voided'
        ) {
          if (statusIntervalRef.current) {
            window.clearInterval(statusIntervalRef.current);
            statusIntervalRef.current = null;
          }
          setIsCheckingPayment(false);
          const reasonStr = String(reason || '');

          // ✅ Qualquer recusa no cartão -> oferecer PIX sem refazer os dados
          if (provider === 'pagarme_card' || provider === 'mercadopago_card') {
            setCardRefusedReason(reasonStr || 'Pagamento no cartão recusado');
            toast.error('Pagamento no cartão recusado. Você pode pagar via PIX sem refazer seus dados.');
            setSelectedMethod(null);
            return;
          }

          toast.error(reasonStr ? `Pagamento recusado/cancelado: ${reasonStr}` : 'Pagamento recusado ou cancelado');
        } else if (attempts >= maxAttempts) {
          if (statusIntervalRef.current) {
            window.clearInterval(statusIntervalRef.current);
            statusIntervalRef.current = null;
          }
          setIsCheckingPayment(false);
          toast.error('Tempo limite de pagamento excedido');
        }
      } catch (e: any) {
        const msg = String(e?.message || 'Erro ao verificar status');
        setLastCheckError(msg);
        if (attempts >= maxAttempts) {
          if (statusIntervalRef.current) {
            window.clearInterval(statusIntervalRef.current);
            statusIntervalRef.current = null;
          }
          setIsCheckingPayment(false);
        }
      }
    }, 5000);
  };

  // Limpar intervalos ao fechar/desmontar
  useEffect(() => {
    if (isOpen) return;
    if (statusIntervalRef.current) {
      window.clearInterval(statusIntervalRef.current);
      statusIntervalRef.current = null;
    }
  }, [isOpen]);

  const handleGeneratePix = async () => {
    // Evitar gerar múltiplos PIX enquanto há um pendente
    if (isCheckingPayment && currentPaymentId) {
      toast.error('Você já tem um PIX gerado. Aguarde a confirmação ou clique em "Verificar agora".');
      return;
    }
    if (paymentProvider === 'mercadopago') {
      // Fluxo Mercado Pago
      if (!amountInCents || amountInCents <= 0) {
        toast.error('Valor da assinatura inválido.');
        return;
      }

      const cpfDigits = String(cpf || '').replace(/\D/g, '');
      if (cpfDigits.length !== 11 && cpfDigits.length !== 14) {
        toast.error('Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.');
        return;
      }
      if (!nome.trim()) {
        toast.error('Informe seu nome.');
        return;
      }
      const phoneDigits = String(whatsapp || '').replace(/\D/g, '');
      if (phoneDigits.length < 10) {
        toast.error('Informe um WhatsApp válido (com DDD).');
        return;
      }

      // ✅ VALIDAÇÃO: Email é obrigatório e deve ser válido
      const payerEmail = String(email || '').trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      if (!payerEmail || !emailRegex.test(payerEmail)) {
        toast.error('Email inválido. Informe um email válido para continuar o pagamento.');
        return;
      }

      setSelectedMethod('pix');
      setIsProcessing(true);
      setPixQrCode('');
      setPixQrCodeUrl('');
      setCardRefusedReason('');

      try {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 25000);

        const createPaymentUrl = import.meta.env.PROD
          ? '/.netlify/functions/mercadopago-create-payment'
          : '/api/mercadopago/create-payment';

        const response = await fetch(createPaymentUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            establishmentId,
            amount: amountInCents,
            description: `Assinatura ${subscription.name}`,
            payer: {
              email: payerEmail,
              identification: {
                type: cpfDigits.length === 11 ? 'CPF' : 'CNPJ',
                number: cpfDigits,
              },
            },
            payment_method_id: 'pix',
            metadata: {
              establishment_id: establishmentId,
              subscription_id: subscription.id,
              subscription_name: subscription.name,
            },
          }),
        });

        window.clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
          const msg = errorData.error || errorData.message || `Erro ${response.status}`;
          throw new Error(msg);
        }

        const result = await response.json();
        const pixData = result.point_of_interaction?.transaction_data;
        if (!pixData?.qr_code && !pixData?.qr_code_base64) {
          throw new Error('Não foi possível gerar o QR Code do PIX.');
        }

        setPixQrCode(pixData.qr_code || '');
        setPixQrCodeUrl(pixData.qr_code_base64 ? `data:image/png;base64,${pixData.qr_code_base64}` : '');
        const expiresIn = 90; // Mercado Pago PIX expira em 90 segundos
        setExpiresInSeconds(expiresIn);
        setRemainingSeconds(expiresIn);
        setIsCheckingPayment(true);
        setCurrentPaymentId(String(result.id || ''));
        setCurrentPaymentProvider('mercadopago_pix');
        checkPaymentStatusPeriodically(result.id, 'mercadopago_pix');
      } catch (err: any) {
        const isAbort = err?.name === 'AbortError';
        toast.error(
          isAbort
            ? 'O servidor de pagamentos demorou demais para responder. Tente novamente.'
            : `Erro ao gerar PIX: ${err?.message || 'Erro desconhecido'}`
        );
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // Fluxo Pagar.me (original)
    // ✅ CORRIGIDO: Só verificar Pagar.me se não estiver usando Mercado Pago
    if (paymentProvider !== 'mercadopago' && !String(recipientId || '').trim()) {
      toast.error('Este estabelecimento ainda não configurou o recebedor da Pagar.me.');
      return;
    }
    if (!amountInCents || amountInCents <= 0) {
      toast.error('Valor da assinatura inválido.');
      return;
    }

    const cpfDigits = String(cpf || '').replace(/\D/g, '');
    if (cpfDigits.length !== 11) {
      toast.error('Informe um CPF válido (11 dígitos).');
      return;
    }
    if (!nome.trim()) {
      toast.error('Informe seu nome.');
      return;
    }
    const phoneDigits = String(whatsapp || '').replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      toast.error('Informe um WhatsApp válido (com DDD).');
      return;
    }

    setSelectedMethod('pix');
    setIsProcessing(true);
    setPixQrCode('');
    setPixQrCodeUrl('');
    setCardRefusedReason('');

    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 25000);

      const createPaymentUrl = import.meta.env.PROD
        ? '/.netlify/functions/pagarme-create-payment'
        : '/api/pagarme/create-payment';

      const response = await fetch(createPaymentUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          amount: amountInCents,
          payment_method: 'pix',
          customer: {
            name: nome.trim(),
            email: email?.trim() || undefined,
            document: cpfDigits,
            phone: phoneDigits,
          },
          split_rules: [
            {
              recipient_id: recipientId,
              amount: amountInCents,
              type: 'flat',
              liable: true,
              charge_processing_fee: false,
            },
          ],
          metadata: {
            establishment_id: establishmentId,
            subscription_id: subscription.id,
            subscription_name: subscription.name,
          },
        }),
      });

      window.clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
        const msg = errorData.userMessage || errorData.error || `Erro ${response.status}`;
        throw new Error(msg);
      }

      const result = await response.json();
      if (!result?.pix?.qr_code) {
        throw new Error('Não foi possível gerar o QR Code do PIX.');
      }

      setPixQrCode(result.pix.qr_code);
      setPixQrCodeUrl(result.pix.qr_code_url || '');
      const expiresIn = Number(result.pix?.expires_in || 90);
      const safeExpiresIn = Number.isFinite(expiresIn) && expiresIn > 0 ? Math.floor(expiresIn) : 90;
      setExpiresInSeconds(safeExpiresIn);
      setRemainingSeconds(safeExpiresIn);
      setIsCheckingPayment(true);
      setCurrentPaymentId(String(result.id || ''));
      setCurrentPaymentProvider('pagarme_pix');
      checkPaymentStatusPeriodically(result.id, 'pagarme_pix');
    } catch (err: any) {
      const isAbort = err?.name === 'AbortError';
      toast.error(
        isAbort
          ? 'O servidor de pagamentos demorou demais para responder. Tente novamente.'
          : `Erro ao gerar PIX: ${err?.message || 'Erro desconhecido'}`
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // ✅ NOVO: Handler para quando o Card Payment Brick submete o formulário
  const handleBrickSubmit = async (formData: {
    token: string;
    payment_method_id: string;
    issuer_id: string;
    installments: number;
    bin?: string;
    lastFourDigits?: string;
  }) => {
    console.log('📦 [MP Brick Subscription] Formulário submetido pelo Brick:', {
      token: formData.token.substring(0, 10) + '...',
      payment_method_id: formData.payment_method_id,
      issuer_id: formData.issuer_id,
      installments: formData.installments,
    });

    // ✅ VALIDAÇÃO: Verificar se endereço e email estão preenchidos antes de processar
    const cepDigits = String(billingCep || '').replace(/\D/g, '');
    const rua = String(billingRua || '').trim();
    const numero = String(billingNumero || '').replace(/\D/g, '');
    const cidade = String(billingCidade || '').trim();
    const uf = String(billingUf || '').trim().toUpperCase();
    const payerEmail = String(email || '').trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Validar endereço
    if (cepDigits.length !== 8) {
      toast.error('CEP inválido. Informe um CEP com 8 dígitos.');
      return;
    }
    if (!rua) {
      toast.error('Informe a rua/avenida do endereço de cobrança.');
      return;
    }
    if (!numero) {
      toast.error('Informe o número do endereço de cobrança.');
      return;
    }
    if (!cidade) {
      toast.error('Informe a cidade do endereço de cobrança.');
      return;
    }
    if (uf.length !== 2) {
      toast.error('Informe a UF (estado) do endereço de cobrança (2 letras).');
      return;
    }

    // Validar email
    if (!payerEmail || !emailRegex.test(payerEmail)) {
      toast.error('Email inválido. Informe um email válido para continuar o pagamento.');
      return;
    }

    setBrickCardToken(formData.token);
    setBrickPaymentMethodId(formData.payment_method_id);
    setBrickIssuerId(formData.issuer_id);
    setBrickInstallments(formData.installments);

    // Processar pagamento com Mercado Pago
    await handlePayWithCardMercadoPago();
  };

  const handleBrickReady = () => {
    console.log('✅ [MP Brick Subscription] Brick está pronto');
    setIsBrickReady(true);
  };

  const handleBrickError = (error: any) => {
    console.error('❌ [MP Brick Subscription] Erro no Brick:', error);
    toast.error(`Erro no formulário de pagamento: ${error?.message || 'Erro desconhecido'}`);
  };

  // ✅ NOVO: Função para pagar com cartão via Mercado Pago
  const handlePayWithCardMercadoPago = async () => {
    if (!hasMercadoPago) {
      toast.error('Estabelecimento não possui conta do Mercado Pago conectada');
      return;
    }

    if (!brickCardToken || !brickPaymentMethodId || !brickIssuerId) {
      toast.error('Dados do cartão não foram fornecidos pelo formulário. Tente novamente.');
      return;
    }

    const cpfDigits = String(cpf || '').replace(/\D/g, '');
    if (cpfDigits.length !== 11 && cpfDigits.length !== 14) {
      toast.error('Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.');
      return;
    }
    if (!nome.trim()) {
      toast.error('Informe seu nome.');
      return;
    }

    // ✅ VALIDAÇÃO: Email é obrigatório e deve ser válido
    const payerEmail = String(email || '').trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!payerEmail || !emailRegex.test(payerEmail)) {
      toast.error('Email inválido. Informe um email válido para continuar o pagamento.');
      return;
    }

    const cepDigits = String(billingCep || '').replace(/\D/g, '');
    const uf = String(billingUf || '').trim().toUpperCase();
    const cidade = String(billingCidade || '').trim();
    const rua = String(billingRua || '').trim();
    const numero = String(billingNumero || '').trim();

    if (cepDigits.length !== 8) {
      toast.error('Informe um CEP válido (8 dígitos) para o endereço de cobrança.');
      return;
    }
    if (!rua || !numero) {
      toast.error('Informe rua e número do endereço de cobrança.');
      return;
    }
    if (!cidade) {
      toast.error('Informe a cidade do endereço de cobrança.');
      return;
    }
    if (!uf || uf.length !== 2) {
      toast.error('Informe a UF do endereço de cobrança (2 letras, ex: SC).');
      return;
    }

    setSelectedMethod('credit_card');
    setIsProcessing(true);
    setPixQrCode('');
    setPixQrCodeUrl('');
    setCardRefusedReason('');

    try {
      const createPaymentUrl = import.meta.env.PROD
        ? '/.netlify/functions/mercadopago-create-payment'
        : '/api/mercadopago/create-payment';

      const response = await fetch(createPaymentUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          establishmentId,
          amount: amountInCents,
          description: `Assinatura ${subscription.name}`,
          payment_method_id: brickPaymentMethodId,
          token: brickCardToken,
          issuer_id: brickIssuerId,
          installments: brickInstallments || 1,
          payer: {
            email: payerEmail,
            identification: {
              type: cpfDigits.length === 11 ? 'CPF' : 'CNPJ',
              number: cpfDigits,
            },
            first_name: nome.trim().split(' ')[0] || '',
            last_name: nome.trim().split(' ').slice(1).join(' ') || nome.trim(),
            address: {
              zip_code: cepDigits,
              street_name: rua,
              street_number: Number(numero) || 0,
              neighborhood: billingBairro || '',
              city: cidade,
              federal_unit: uf,
            },
          },
          metadata: {
            establishment_id: establishmentId,
            subscription_id: subscription.id,
            subscription_name: subscription.name,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
        const msg = errorData.error || errorData.message || `Erro ${response.status}`;
        throw new Error(msg);
      }

      const result = await response.json();
      const normalized = String(result?.status || '').toLowerCase();

      if (normalized === 'approved' || normalized === 'authorized') {
        await (async () => {
          const confirmUrl = import.meta.env.PROD
            ? '/.netlify/functions/subscription-confirm-pix'
            : '/api/subscribers/confirm-subscription-pix';

          const resp = await fetch(confirmUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: result.id,
              establishmentId,
              subscriptionId: subscription.id,
              provider: 'mercadopago_card',
              customer: {
                name: nome.trim(),
                whatsapp: whatsapp,
                email: email?.trim() || undefined,
                document: cpfDigits,
              },
            }),
          });

          if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            const msg = err?.error || `Erro ${resp.status}`;
            throw new Error(msg);
          }
        })();

        setIsPaid(true);
        return;
      }

      setIsCheckingPayment(true);
      checkPaymentStatusPeriodically(result.id, 'mercadopago_card');
    } catch (err: any) {
      toast.error(`Erro ao pagar com cartão: ${err?.message || 'Erro desconhecido'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // ✅ CORRIGIDO: Função para pagar com cartão via Pagar.me (apenas quando não é Mercado Pago)
  const handlePayWithCard = async () => {
    // ✅ CORRIGIDO: Não verificar Pagar.me se está usando Mercado Pago
    if (paymentProvider === 'mercadopago' && hasMercadoPago) {
      // Se está usando Mercado Pago, o Brick já chama handlePayWithCardMercadoPago
      toast.error('Use o formulário de cartão do Mercado Pago acima.');
      return;
    }

    // ✅ CORRIGIDO: Só verificar Pagar.me se não estiver usando Mercado Pago
    if (paymentProvider !== 'mercadopago' && !String(recipientId || '').trim()) {
      toast.error('Este estabelecimento ainda não configurou o recebedor da Pagar.me.');
      return;
    }
    if (!amountInCents || amountInCents <= 0) {
      toast.error('Valor da assinatura inválido.');
      return;
    }

    const cpfDigits = String(cpf || '').replace(/\D/g, '');
    if (cpfDigits.length !== 11) {
      toast.error('Informe um CPF válido (11 dígitos).');
      return;
    }
    if (!nome.trim()) {
      toast.error('Informe seu nome.');
      return;
    }
    const phoneDigits = String(whatsapp || '').replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      toast.error('Informe um WhatsApp válido (com DDD).');
      return;
    }

    const numberDigits = String(cardNumber || '').replace(/\D/g, '');
    const expMonthDigits = String(cardExpMonth || '').replace(/\D/g, '');
    const expYearDigits = String(cardExpYear || '').replace(/\D/g, '');
    const cvvDigits = String(cardCvv || '').replace(/\D/g, '');
    const holder = String(cardHolderName || '').trim();

    if (numberDigits.length < 13 || numberDigits.length > 19) {
      toast.error('Número do cartão inválido.');
      return;
    }
    const monthNum = Number(expMonthDigits);
    if (!Number.isFinite(monthNum) || monthNum < 1 || monthNum > 12) {
      toast.error('Mês de validade inválido (1 a 12).');
      return;
    }
    if (!expYearDigits || expYearDigits.length < 2) {
      toast.error('Ano de validade inválido.');
      return;
    }
    if (cvvDigits.length < 3 || cvvDigits.length > 4) {
      toast.error('CVV inválido.');
      return;
    }
    if (!holder) {
      toast.error('Informe o nome do titular do cartão.');
      return;
    }

    const cepDigits = String(billingCep || '').replace(/\D/g, '');
    const uf = String(billingUf || '').trim().toUpperCase();
    const cidade = String(billingCidade || '').trim();
    const rua = String(billingRua || '').trim();
    const numero = String(billingNumero || '').trim();
    const bairro = String(billingBairro || '').trim();

    if (cepDigits.length !== 8) {
      toast.error('Informe um CEP válido (8 dígitos) para o endereço de cobrança.');
      return;
    }
    if (!rua || !numero) {
      toast.error('Informe rua e número do endereço de cobrança.');
      return;
    }
    if (!cidade) {
      toast.error('Informe a cidade do endereço de cobrança.');
      return;
    }
    if (!uf || uf.length !== 2) {
      toast.error('Informe a UF do endereço de cobrança (2 letras, ex: SC).');
      return;
    }

    setSelectedMethod('credit_card');
    setIsProcessing(true);
    setPixQrCode('');
    setPixQrCodeUrl('');
    setCardRefusedReason('');

    try {
      const cardToken = await criarTokenCartaoPagarme({
        number: numberDigits,
        holder_name: holder,
        exp_month: String(monthNum).padStart(2, '0'),
        exp_year: expYearDigits,
        cvv: cvvDigits,
        holder_document: cpfDigits,
      });

      const billingAddress = {
        line_1: bairro ? `${rua}, ${numero} - ${bairro}` : `${rua}, ${numero}`,
        zip_code: cepDigits,
        city: cidade,
        state: uf,
        country: 'BR',
      };

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 25000);

      const createPaymentUrl = import.meta.env.PROD
        ? '/.netlify/functions/pagarme-create-payment'
        : '/api/pagarme/create-payment';

      const response = await fetch(createPaymentUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          amount: amountInCents,
          payment_method: 'credit_card',
          card_token: cardToken,
          billing_address: billingAddress,
          customer: {
            name: nome.trim(),
            email: email?.trim() || undefined,
            document: cpfDigits,
            phone: phoneDigits,
          },
          split_rules: [
            {
              recipient_id: recipientId,
              amount: amountInCents,
              type: 'flat',
              liable: true,
              charge_processing_fee: false,
            },
          ],
          metadata: {
            establishment_id: establishmentId,
            subscription_id: subscription.id,
            subscription_name: subscription.name,
          },
        }),
      });

      window.clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
        const msg = errorData.userMessage || errorData.error || `Erro ${response.status}`;
        throw new Error(msg);
      }

      const result = await response.json();

      // Cartão geralmente não tem QR; confirmamos por status/polling
      const normalized = String(result?.status || '').toLowerCase();
      if (normalized === 'paid' || normalized === 'authorized') {
        await (async () => {
          const confirmUrl = import.meta.env.PROD
            ? '/.netlify/functions/subscription-confirm-pix'
            : '/api/subscribers/confirm-subscription-pix';

          const resp = await fetch(confirmUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: result.id,
              establishmentId,
              subscriptionId: subscription.id,
              provider: 'pagarme_card',
              customer: {
                name: nome.trim(),
                whatsapp: whatsapp,
                email: email?.trim() || undefined,
                document: cpfDigits,
              },
            }),
          });

          if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            const msg = err?.error || `Erro ${resp.status}`;
            throw new Error(msg);
          }
        })();

        setIsPaid(true);
        return;
      }

      setIsCheckingPayment(true);
      checkPaymentStatusPeriodically(result.id, 'pagarme_card');
    } catch (err: any) {
      const isAbort = err?.name === 'AbortError';
      toast.error(
        isAbort
          ? 'O servidor de pagamentos demorou demais para responder. Tente novamente.'
          : `Erro ao pagar com cartão: ${err?.message || 'Erro desconhecido'}`
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // ✅ Prevenir scroll da página de trás quando modal está aberto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  const handleSafeClose = useCallback(() => {
    if (statusIntervalRef.current) {
      window.clearInterval(statusIntervalRef.current);
      statusIntervalRef.current = null;
    }
    if (countdownRef.current) {
      window.clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setIsCheckingPayment(false);
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isProcessing) {
          handleSafeClose();
        }
      }}
    >
      <div className="bg-[#1a1b1c] rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] min-h-[50vh] flex flex-col my-auto border border-gray-800 text-white">
        {/* Header fixo */}
        <div className="flex items-center justify-between p-6 pb-4 flex-shrink-0 border-b border-gray-800/50">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Assinatura
          </h2>
          {!isProcessing && (
            <button onClick={handleSafeClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <X className="h-5 w-5 text-gray-300" />
            </button>
          )}
        </div>

        {/* Conteúdo com scroll */}
        <div className="flex-1 overflow-y-auto px-6 pb-6" style={{ minHeight: 0, WebkitOverflowScrolling: 'touch' }}>
          <div className="bg-[#111213] border border-gray-700 rounded-lg p-4 mb-4">
          <p className="text-sm text-gray-200">
            Plano: <span className="font-semibold">{subscription.name}</span>
          </p>
          <p className="text-sm text-gray-200 mt-1">
            Valor: <span className="font-semibold">R$ {Number(subscription.value || 0).toFixed(2).replace('.', ',')}</span>
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Todo mês você será lembrado para renovar sua assinatura automaticamente.
          </p>
        </div>

        {isPaid ? (
          <div className="space-y-4">
            <div className="bg-green-600/15 border border-green-500/40 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-6 w-6 text-green-300 mt-0.5" />
                <div>
                  <p className="text-green-200 font-extrabold text-base">Parabéns! Você assinou ✅</p>
                  <p className="text-sm text-gray-200 mt-1">
                    Plano: <span className="font-semibold">{subscription.name}</span> da barbearia{' '}
                    <span className="font-semibold">{establishmentName}</span>.
                  </p>
                  <p className="text-sm text-gray-300 mt-2">
                    Agora avise seu barbeiro e pronto.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                const phone = String(establishmentWhatsapp || '').replace(/\D/g, '');
                if (!phone) {
                  toast.error('WhatsApp do estabelecimento não configurado.');
                  return;
                }
                const phoneWithCountry = phone.startsWith('55') ? phone : `55${phone}`;
                const message = `Parabéns! Acabei de assinar o plano "${subscription.name}" da barbearia ${establishmentName}. ✅\n\nMeu nome: ${nome || ''}\nMeu WhatsApp: ${whatsapp || ''}\n\nPode confirmar pra mim?`;
                window.open(`https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`, '_blank');
              }}
              className="w-full px-4 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-extrabold transition-colors flex items-center justify-center gap-2"
            >
              <MessageCircle className="h-5 w-5" />
              Avisar meu barbeiro no WhatsApp
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full px-4 py-2 rounded-lg bg-[#2a2b2c] hover:bg-[#343536] text-white font-semibold transition-colors border border-gray-700"
            >
              Fechar
            </button>
          </div>
        ) : !pixQrCode ? (
          <div className="space-y-3">
            {cardRefusedReason ? (
              <div className="bg-red-900/30 border border-red-700/60 rounded-lg p-4">
                <p className="text-sm text-red-200 font-semibold">Pagamento no cartão recusado</p>
                <p className="text-xs text-red-200/90 mt-1">{cardRefusedReason}</p>
                <button
                  type="button"
                  onClick={handleGeneratePix}
                  className="w-full mt-3 px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-extrabold transition-colors"
                >
                  Pagar com PIX agora (sem refazer)
                </button>
              </div>
            ) : null}

            <div>
              <label className="block text-sm text-gray-300 mb-1">Seu nome</label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-[#111213] border border-gray-700 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nome completo"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">WhatsApp (com DDD)</label>
              <input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-[#111213] border border-gray-700 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="(48) 99999-9999"
                inputMode="tel"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">CPF (obrigatório)</label>
              <input
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-[#111213] border border-gray-700 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Somente números"
                inputMode="numeric"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Email (opcional)</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-[#111213] border border-gray-700 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="email@exemplo.com"
                inputMode="email"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2">
              <button
                onClick={handleGeneratePix}
                disabled={isProcessing}
                className="w-full px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessing && selectedMethod === 'pix' ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <QrCode className="h-5 w-5" />
                    PIX
                  </>
                )}
              </button>

                <button
                  onClick={() => {
                    setSelectedMethod('credit_card');
                    // Não processar automaticamente - aguardar preenchimento do formulário
                  }}
                  disabled={isProcessing}
                  className="w-full px-4 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <CreditCard className="h-5 w-5" />
                  Cartão
                </button>
            </div>

            {selectedMethod === 'credit_card' ? (
              <div className="mt-3 space-y-3 border-t border-gray-800 pt-3">
                {/* ✅ REORGANIZADO: Endereço de cobrança ANTES do cartão (melhor UX) */}
                <div className="mb-4 border-b border-gray-800 pb-3 space-y-3">
                  <p className="text-sm text-gray-200 font-semibold">Endereço de cobrança (obrigatório no cartão)</p>

                  <div>
                    <label className="block text-sm text-gray-300 mb-1">CEP</label>
                    <input
                      value={billingCep}
                      onChange={(e) => setBillingCep(e.target.value)}
                      className="w-full px-3 py-2 rounded-md bg-[#111213] border border-gray-700 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Somente números"
                      inputMode="numeric"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Rua</label>
                    <input
                      value={billingRua}
                      onChange={(e) => setBillingRua(e.target.value)}
                      className="w-full px-3 py-2 rounded-md bg-[#111213] border border-gray-700 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Rua/Avenida"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">Número</label>
                      <input
                        value={billingNumero}
                        onChange={(e) => setBillingNumero(e.target.value)}
                        className="w-full px-3 py-2 rounded-md bg-[#111213] border border-gray-700 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="Nº"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">Bairro (opcional)</label>
                      <input
                        value={billingBairro}
                        onChange={(e) => setBillingBairro(e.target.value)}
                        className="w-full px-3 py-2 rounded-md bg-[#111213] border border-gray-700 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="Bairro"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">Cidade</label>
                      <input
                        value={billingCidade}
                        onChange={(e) => setBillingCidade(e.target.value)}
                        className="w-full px-3 py-2 rounded-md bg-[#111213] border border-gray-700 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="Cidade"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">Estado (UF)</label>
                      <input
                        value={billingUf}
                        onChange={(e) => setBillingUf(e.target.value)}
                        className="w-full px-3 py-2 rounded-md bg-[#111213] border border-gray-700 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="Ex: SC / SP / RJ"
                        maxLength={2}
                      />
                      <p className="text-[11px] text-gray-400 mt-1">UF = sigla do estado (2 letras).</p>
                    </div>
                  </div>
                </div>

                {/* ✅ NOVO: Card Payment Brick do Mercado Pago (Secure Fields) - DEPOIS do endereço */}
                <div className="mt-4 border-t border-gray-800 pt-4">
                  <label className="block text-sm text-gray-300 mb-2">Dados do cartão</label>
                  {/* ✅ Mensagem informativa sobre segurança */}
                  <div className="bg-blue-900/20 border border-blue-700/40 rounded-lg p-2.5 mb-3">
                    <p className="text-xs text-blue-200/90">
                      <span className="font-semibold">ℹ️ Por segurança:</span> Os dados do cartão (número, validade, CVV) não são salvos. 
                      Se você sair e voltar, precisará preencher novamente. Seu endereço e email são salvos automaticamente.
                    </p>
                  </div>
                  {hasMercadoPago ? (() => {
                    const docDigitsForBrick = String(cpf || '').replace(/\D/g, '');
                    const identificationTypeForBrick = docDigitsForBrick.length === 11 ? 'CPF' : 'CNPJ';
                    
                    return (
                      <CardPaymentBrick
                        publicKey={String(import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY || '').trim()}
                        amount={Number(subscription.value || 0)}
                        onSubmit={handleBrickSubmit}
                        onReady={handleBrickReady}
                        onError={handleBrickError}
                        payerData={{
                          email: email?.trim() || '',
                          identificationType: identificationTypeForBrick,
                          identificationNumber: docDigitsForBrick,
                          firstName: nome.split(' ')[0] || '',
                          lastName: nome.split(' ').slice(1).join(' ') || nome || '',
                        }}
                      />
                    );
                  })() : (
                    <>
                      {/* ✅ Pagar.me ainda usa inputs manuais (não tem Brick) */}
                      <div className="bg-green-600/10 border border-green-500/30 rounded-lg p-3 mb-3">
                        <p className="text-sm text-green-200">
                          Cartão usa tokenização segura (Pagar.me). O número do cartão não vai para o servidor.
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm text-gray-300 mb-1">Número do cartão</label>
                        <input
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value)}
                          className="w-full px-3 py-2 rounded-md bg-[#111213] border border-gray-700 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                          placeholder="0000 0000 0000 0000"
                          inputMode="numeric"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-gray-300 mb-1">Nome do titular</label>
                        <input
                          value={cardHolderName}
                          onChange={(e) => setCardHolderName(e.target.value)}
                          className="w-full px-3 py-2 rounded-md bg-[#111213] border border-gray-700 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                          placeholder="Como está no cartão"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-1">
                          <label className="block text-sm text-gray-300 mb-1">Mês</label>
                          <input
                            value={cardExpMonth}
                            onChange={(e) => setCardExpMonth(e.target.value)}
                            className="w-full px-3 py-2 rounded-md bg-[#111213] border border-gray-700 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                            placeholder="MM"
                            inputMode="numeric"
                          />
                        </div>
                        <div className="col-span-1">
                          <label className="block text-sm text-gray-300 mb-1">Ano</label>
                          <input
                            value={cardExpYear}
                            onChange={(e) => setCardExpYear(e.target.value)}
                            className="w-full px-3 py-2 rounded-md bg-[#111213] border border-gray-700 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                            placeholder="AA ou AAAA"
                            inputMode="numeric"
                          />
                        </div>
                        <div className="col-span-1">
                          <label className="block text-sm text-gray-300 mb-1">CVV</label>
                          <input
                            value={cardCvv}
                            onChange={(e) => setCardCvv(e.target.value)}
                            className="w-full px-3 py-2 rounded-md bg-[#111213] border border-gray-700 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                            placeholder="123"
                            inputMode="numeric"
                          />
                        </div>
                      </div>

                      <button
                        onClick={handlePayWithCard}
                        disabled={isProcessing || isCheckingPayment}
                        className="w-full mt-4 px-4 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-extrabold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isProcessing && selectedMethod === 'credit_card' ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Processando...
                          </>
                        ) : (
                          <>
                            <CreditCard className="h-5 w-5" />
                            Pagar com Cartão
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-green-600/15 border border-green-500/40 rounded-lg p-3 text-center">
              <p className="text-sm text-green-300">Escaneie o QR Code abaixo para pagar</p>
              <p className="text-xs text-green-200/90 mt-2">
                ⏱️ Tempo para pagar:{' '}
                <span className="font-bold">{formatMMSS(remainingSeconds || expiresInSeconds)}</span>
              </p>
            </div>

            {pixQrCodeUrl ? (
              <div className="flex justify-center">
                <div className="bg-white p-3 rounded-lg">
                  <img src={pixQrCodeUrl} alt="QR Code PIX" className="w-64 h-64" />
                </div>
              </div>
            ) : null}

            <div>
              <p className="text-sm text-gray-300 mb-2 text-center">PIX Copia e Cola</p>
              <textarea
                value={pixQrCode}
                readOnly
                className="w-full h-28 px-3 py-2 rounded-md bg-[#111213] border border-gray-700 text-gray-200 text-xs"
              />
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(pixQrCode);
                    toast.success('Código PIX copiado!');
                  } catch {
                    toast.error('Não foi possível copiar. Copie manualmente.');
                  }
                }}
                className="w-full mt-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
              >
                COPIAR CÓDIGO PIX
              </button>
            </div>

            <div className="space-y-2">
              {isCheckingPayment && (
                <div className="flex items-center justify-center gap-2 text-blue-300">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Aguardando confirmação do pagamento...</span>
                </div>
              )}

              {lastCheckError && isCheckingPayment && (
                <div className="text-center text-xs text-red-300">
                  Falha ao verificar status: {lastCheckError}
                </div>
              )}

              {(pixQrCode || currentPaymentId) && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={async () => {
                      const id = String(currentPaymentId || '').trim();
                      const provider =
                        currentPaymentProvider ||
                        (paymentProvider === 'mercadopago' ? 'mercadopago_pix' : 'pagarme_pix');

                      if (!id) {
                        toast.error('Nenhum pagamento para verificar. Gere o PIX novamente.');
                        return;
                      }

                      setIsCheckingPayment(true);
                      try {
                        const { normalized } = await checkPaymentStatusOnce(id, provider);
                        if (normalized === 'paid' || normalized === 'authorized' || normalized === 'approved') {
                          try {
                            await confirmSubscription(id, provider);
                          } catch (e: any) {
                            toast.error(`Pagamento confirmado, mas falhou registrar: ${e?.message || 'erro'}`);
                          }
                          setIsPaid(true);
                          setIsCheckingPayment(false);
                          toast.success('Pagamento confirmado!');
                        } else {
                          toast.error(`Ainda não confirmado (status: ${normalized || 'desconhecido'})`);
                        }
                      } catch (e: any) {
                        toast.error(e?.message || 'Erro ao verificar');
                      }
                    }}
                    className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    Verificar agora
                  </button>

                  <button
                    type="button"
                    onClick={handleSafeClose}
                    className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white font-semibold transition-colors"
                  >
                    Fechar
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};


