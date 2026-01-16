import { CreditCard, Loader2, QrCode, Wallet, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useToast } from './ui/Toaster';
// Import removido - agora usa API Routes
import { supabase } from '../lib/supabase';
import { criarTokenCartaoPagarme } from '../lib/pagarmeTokenize';
import { CardPaymentBrick } from './CardPaymentBrick';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointmentId: string;
  amount: number; // Valor em reais
  establishmentId: string;
  recipientId?: string; // ID do recebedor na Pagar.me (opcional se usar Mercado Pago)
  onPaymentSuccess: (clientPhone?: string) => void;
  onPaymentFailure: () => void;
  customerData: {
    name: string;
    email?: string;
    phone?: string;
    document?: string;
  };
  // Se false: não cancela agendamento se o cliente não pagar (modo opcional)
  cancelAppointmentOnFailure?: boolean;
}

type PaymentMethod = 'pix' | 'credit_card' | 'debit_card' | null;

export const PaymentModal = ({
  isOpen,
  onClose,
  appointmentId,
  amount,
  establishmentId,
  recipientId,
  onPaymentSuccess,
  onPaymentFailure,
  customerData,
  cancelAppointmentOnFailure = true,
}: PaymentModalProps) => {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pixQrCode, setPixQrCode] = useState<string>('');
  const [pixQrCodeUrl, setPixQrCodeUrl] = useState<string>('');
  const [pixExpiresInSeconds, setPixExpiresInSeconds] = useState<number>(90);
  const [pixRemainingSeconds, setPixRemainingSeconds] = useState<number>(0);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [cpfCliente, setCpfCliente] = useState<string>(customerData.document || '');
  // ✅ NÃO preencher automaticamente com email de guest - cliente deve preencher manualmente
  const [payerEmail, setPayerEmail] = useState<string>(() => {
    const email = customerData.email || '';
    // Se for email de guest (contém "guest_" ou "@agendafaci"), deixar vazio
    if (email.includes('guest_') || email.includes('@agendafaci')) {
      return '';
    }
    return email;
  });
  // ✅ Estados dos inputs manuais de cartão (apenas para Pagar.me - Mercado Pago usa Brick)
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
  const [cardRefusedReason, setCardRefusedReason] = useState<string>('');
  const [hasPagarMeError, setHasPagarMeError] = useState(false);
  const [hasMercadoPago, setHasMercadoPago] = useState(false);
  // ✅ NOVO: Estados para dados do Card Payment Brick
  const [brickCardToken, setBrickCardToken] = useState<string | null>(null);
  const [brickPaymentMethodId, setBrickPaymentMethodId] = useState<string | null>(null);
  const [brickIssuerId, setBrickIssuerId] = useState<string | null>(null);
  const [brickInstallments, setBrickInstallments] = useState<number>(1);
  const [isBrickReady, setIsBrickReady] = useState(false);
  const { toast } = useToast();
  const pixCountdownIntervalRef = useRef<number | null>(null);
  const isCheckingPaymentRef = useRef<boolean>(false);
  const currentPaymentIdRef = useRef<number | null>(null);

  // Valor em centavos
  const amountInCents = Math.round(amount * 100);
  // O split é montado no BACKEND (Express) para não expor/configurar recipient da plataforma no frontend.

  // Verificar qual gateway de pagamento está configurado (Pagar.me ou Mercado Pago)
  useEffect(() => {
    if (isOpen && establishmentId) {
      supabase
        .from('establishments')
        .select('mercadopago_access_token, pagarme_recipient_id, exigir_pagamento_antecipado_mercadopago, exigir_pagamento_antecipado')
        .eq('id', establishmentId)
        .single()
        .then(({ data }) => {
          const hasMP = !!data?.mercadopago_access_token;
          const hasPM = !!data?.pagarme_recipient_id;
          const exigirMP = Boolean(data?.exigir_pagamento_antecipado_mercadopago === true);
          const exigirPM = Boolean(data?.exigir_pagamento_antecipado === true);
          
          // ✅ CORRIGIDO: Prioridade baseada em qual gateway está configurado para exigir
          // Se Mercado Pago está marcado para exigir → usar Mercado Pago
          // Se apenas Pagar.me está marcado para exigir → usar Pagar.me
          // Se ambos estão marcados → prioridade para Mercado Pago
          // Se nenhum está marcado para exigir → usar Mercado Pago se disponível (sem Pagar.me)
          if (exigirMP && hasMP) {
            // Mercado Pago está configurado para exigir pagamento antecipado → usar Mercado Pago
            setHasMercadoPago(true);
          } else if (exigirPM && hasPM) {
            // Apenas Pagar.me está configurado para exigir → usar Pagar.me
            setHasMercadoPago(false);
          } else {
            // Fallback: se nenhum está marcado para exigir, usar Mercado Pago se disponível (sem Pagar.me)
            setHasMercadoPago(hasMP && !hasPM);
          }
        })
        .catch(() => {
          setHasMercadoPago(false);
        });
    } else if (!isOpen) {
      // Limpar estados e refs quando o modal fechar
      if (pixCountdownIntervalRef.current) {
        window.clearInterval(pixCountdownIntervalRef.current);
        pixCountdownIntervalRef.current = null;
      }
      setIsCheckingPayment(false);
      isCheckingPaymentRef.current = false;
      currentPaymentIdRef.current = null;
      setPixQrCode('');
      setPixRemainingSeconds(0);
      setHasPagarMeError(false);
      // ✅ NÃO limpar dados do cartão e endereço - manter para o usuário não perder ao voltar
      // setBrickCardToken(null);
      // setBrickPaymentMethodId(null);
      // setBrickIssuerId(null);
      // setBillingCep('');
      // setBillingRua('');
      // etc...
    }
  }, [isOpen, establishmentId]);

  // ✅ NOVO: Salvar dados do endereço e email no localStorage para persistir
  useEffect(() => {
    if (isOpen) {
      // Carregar dados salvos ao abrir o modal
      try {
        const savedBillingCep = localStorage.getItem(`payment_billing_cep_${establishmentId}`);
        const savedBillingRua = localStorage.getItem(`payment_billing_rua_${establishmentId}`);
        const savedBillingNumero = localStorage.getItem(`payment_billing_numero_${establishmentId}`);
        const savedBillingBairro = localStorage.getItem(`payment_billing_bairro_${establishmentId}`);
        const savedBillingCidade = localStorage.getItem(`payment_billing_cidade_${establishmentId}`);
        const savedBillingUf = localStorage.getItem(`payment_billing_uf_${establishmentId}`);
        const savedPayerEmail = localStorage.getItem(`payment_payer_email_${establishmentId}`);
        
        if (savedBillingCep && !billingCep) setBillingCep(savedBillingCep);
        if (savedBillingRua && !billingRua) setBillingRua(savedBillingRua);
        if (savedBillingNumero && !billingNumero) setBillingNumero(savedBillingNumero);
        if (savedBillingBairro && !billingBairro) setBillingBairro(savedBillingBairro);
        if (savedBillingCidade && !billingCidade) setBillingCidade(savedBillingCidade);
        if (savedBillingUf && !billingUf) setBillingUf(savedBillingUf);
        if (savedPayerEmail && !payerEmail) {
          // Só usar se não for email de guest
          if (!savedPayerEmail.includes('guest_') && !savedPayerEmail.includes('@agendafaci')) {
            setPayerEmail(savedPayerEmail);
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
        if (billingCep) localStorage.setItem(`payment_billing_cep_${establishmentId}`, billingCep);
        if (billingRua) localStorage.setItem(`payment_billing_rua_${establishmentId}`, billingRua);
        if (billingNumero) localStorage.setItem(`payment_billing_numero_${establishmentId}`, billingNumero);
        if (billingBairro) localStorage.setItem(`payment_billing_bairro_${establishmentId}`, billingBairro);
        if (billingCidade) localStorage.setItem(`payment_billing_cidade_${establishmentId}`, billingCidade);
        if (billingUf) localStorage.setItem(`payment_billing_uf_${establishmentId}`, billingUf);
        if (payerEmail && !payerEmail.includes('guest_') && !payerEmail.includes('@agendafaci')) {
          localStorage.setItem(`payment_payer_email_${establishmentId}`, payerEmail);
        }
      } catch (e) {
        console.warn('⚠️ Erro ao salvar dados:', e);
      }
    }
  }, [isOpen, establishmentId, billingCep, billingRua, billingNumero, billingBairro, billingCidade, billingUf, payerEmail]);

  // ✅ NOVO: Handler para quando o Card Payment Brick submete o formulário
  const handleBrickSubmit = async (formData: {
    token: string;
    payment_method_id: string;
    issuer_id: string;
    installments: number;
    bin?: string;
    lastFourDigits?: string;
  }) => {
    console.log('📦 [MP Brick] Formulário submetido pelo Brick:', {
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
    const emailToUse = String(payerEmail || customerData.email || '').trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Validar endereço
    if (cepDigits.length !== 8) {
      toast('CEP inválido. Informe um CEP com 8 dígitos.', 'error');
      return;
    }
    if (!rua) {
      toast('Informe a rua/avenida do endereço de cobrança.', 'error');
      return;
    }
    if (!numero) {
      toast('Informe o número do endereço de cobrança.', 'error');
      return;
    }
    if (!cidade) {
      toast('Informe a cidade do endereço de cobrança.', 'error');
      return;
    }
    if (uf.length !== 2) {
      toast('Informe a UF (estado) do endereço de cobrança (2 letras).', 'error');
      return;
    }

    // Validar email
    if (!emailToUse || !emailRegex.test(emailToUse)) {
      toast('Email inválido. Informe um email válido para continuar o pagamento.', 'error');
      return;
    }

    // ✅ Salvar dados do Brick nos estados
    setBrickCardToken(formData.token);
    setBrickPaymentMethodId(formData.payment_method_id);
    setBrickIssuerId(formData.issuer_id);
    setBrickInstallments(formData.installments);

    // ✅ Processar pagamento com os dados do Brick
    await handleMercadoPagoPayment('credit_card');
  };

  // ✅ NOVO: Handler para quando o Brick está pronto
  const handleBrickReady = () => {
    console.log('✅ [MP Brick] Brick está pronto');
    setIsBrickReady(true);
  };

  // ✅ NOVO: Handler para erros do Brick
  const handleBrickError = (error: any) => {
    console.error('❌ [MP Brick] Erro no Brick:', error);
    toast(`Erro no formulário de pagamento: ${error?.message || 'Erro desconhecido'}`, 'error');
  };

  // Função para pagar com Mercado Pago (PIX ou Cartão)
  const handleMercadoPagoPayment = async (method: 'pix' | 'credit_card' = 'pix') => {
    if (!hasMercadoPago) {
      toast('Estabelecimento não possui conta do Mercado Pago conectada', 'error');
      return;
    }

    const docDigits = String(cpfCliente || '').replace(/\D/g, '');
    if (!(docDigits.length === 11 || docDigits.length === 14)) {
      toast('Informe um CPF (11) ou CNPJ (14) válido para continuar.', 'error');
      return;
    }

    // ✅ CORRIGIDO: Definir identificationType logo após normalizar CPF/CNPJ
    // Isso garante que seja usado o mesmo tipo na tokenização E no pagamento
    const identificationType = docDigits.length === 11 ? 'CPF' : 'CNPJ';

    // Definir selectedMethod para que confirmAppointment saiba qual método foi usado
    if (method === 'pix') {
      setSelectedMethod('pix');
    } else {
      setSelectedMethod('credit_card');
    }

    // ✅ REMOVIDO: Validação manual de cartão para Mercado Pago (agora usa Card Payment Brick)
    // O Brick valida automaticamente os dados do cartão
    // Apenas validar endereço de cobrança (ainda necessário)
    if (method === 'credit_card') {
      // ✅ Validar apenas se o Brick está pronto (para Mercado Pago)
      // NÃO validar token aqui - o Brick vai chamar handleBrickSubmit quando o usuário clicar no botão
      if (hasMercadoPago) {
        if (!isBrickReady) {
          toast('Aguarde o formulário de pagamento carregar.', 'error');
          return;
        }
        // ✅ REMOVIDO: Não validar token aqui - o Brick faz isso no onSubmit
        // A validação será feita quando o Brick chamar handleBrickSubmit
      }

      // Validar endereço de cobrança (obrigatório para cartão)
      const cepDigits = String(billingCep || '').replace(/\D/g, '');
      const rua = String(billingRua || '').trim();
      const numero = String(billingNumero || '').replace(/\D/g, '');
      const cidade = String(billingCidade || '').trim();
      const uf = String(billingUf || '').trim().toUpperCase();

      if (cepDigits.length !== 8) {
        toast('CEP inválido. Informe um CEP com 8 dígitos.', 'error');
        return;
      }
      if (!rua) {
        toast('Informe a rua/avenida do endereço de cobrança.', 'error');
        return;
      }
      if (!numero) {
        toast('Informe o número do endereço de cobrança.', 'error');
        return;
      }
      if (!cidade) {
        toast('Informe a cidade do endereço de cobrança.', 'error');
        return;
      }
      if (uf.length !== 2) {
        toast('Informe a UF (estado) do endereço de cobrança (2 letras).', 'error');
        return;
      }
    }

    setIsProcessing(true);
    setHasPagarMeError(false);

    try {
      // ✅ NOVO: Usar dados do Card Payment Brick (não tokenização manual)
      let cardToken: string | undefined;
      let cardPaymentMethodId: string | undefined;
      let cardIssuerId: string | undefined;
      let cardInstallments: number = 1;

      // Se for cartão de crédito, usar dados do Brick
      if (method === 'credit_card') {
        // ✅ VALIDAÇÃO: Garantir que o Brick forneceu todos os dados necessários
        // Esta validação só acontece quando handleBrickSubmit é chamado (quando o usuário clica no botão do Brick)
        if (!brickCardToken || !brickPaymentMethodId || !brickIssuerId) {
          // ✅ Se não tem dados, significa que o Brick ainda não foi submetido
          // Isso não deveria acontecer aqui, mas se acontecer, mostrar erro mais claro
          console.error('❌ [MP Payment] Dados do Brick não disponíveis:', {
            hasToken: !!brickCardToken,
            hasPaymentMethodId: !!brickPaymentMethodId,
            hasIssuerId: !!brickIssuerId,
            isBrickReady,
          });
          toast('Por favor, preencha e submeta o formulário de cartão acima antes de continuar.', 'error');
          setIsProcessing(false);
          return;
        }

        // ✅ USAR APENAS OS DADOS RETORNADOS PELO BRICK (sem hardcode)
        cardToken = brickCardToken;
        cardPaymentMethodId = brickPaymentMethodId; // ✅ OBRIGATÓRIO: visa, master, elo, etc. (vem do Brick)
        cardIssuerId = brickIssuerId; // ✅ OBRIGATÓRIO: ID do banco emissor (vem do Brick)
        cardInstallments = brickInstallments || 1;

        console.log('✅ [MP Brick] Dados do Brick que serão usados no pagamento:', {
          token: cardToken.substring(0, 10) + '...',
          payment_method_id: cardPaymentMethodId, // ✅ Nunca será 'credit_card'
          issuer_id: cardIssuerId,
          installments: cardInstallments,
        });
      }

      // ✅ NOVO: Preparar dados do pagador
      // O Brick já coleta nome do titular, então não precisamos mais fazer isso manualmente
      
      // ✅ VALIDAÇÃO: Email é obrigatório e deve ser válido
      const emailToUse = String(payerEmail || customerData.email || '').trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      if (!emailToUse || !emailRegex.test(emailToUse)) {
        toast('Email inválido. Informe um email válido para continuar o pagamento.', 'error');
        setIsProcessing(false);
        return;
      }

      const payerData: any = {
        email: emailToUse,
        identification: {
          type: identificationType, // Usar o mesmo tipo definido acima
          number: docDigits, // Usar o mesmo CPF/CNPJ normalizado (só dígitos)
        },
        // ✅ O Brick já envia first_name e last_name no token, então não precisamos adicionar aqui
        // O backend vai usar os dados do token automaticamente
      };

      // ✅ CORRIGIDO: Adicionar endereço de cobrança para cartão (obrigatório no Mercado Pago)
      // Validar todos os campos obrigatórios antes de enviar
      if (method === 'credit_card') {
        const cepDigits = String(billingCep || '').replace(/\D/g, '');
        const rua = String(billingRua || '').trim();
        const numeroStr = String(billingNumero || '').replace(/\D/g, '');
        const numero = Number(numeroStr) || 1; // Se não tiver número, usar 1 (evita 0)
        const cidade = String(billingCidade || '').trim();
        const uf = String(billingUf || '').trim().toUpperCase();

        // Validar campos obrigatórios
        if (!cepDigits || cepDigits.length !== 8) {
          throw new Error('CEP inválido. Informe um CEP com 8 dígitos.');
        }
        if (!rua) {
          throw new Error('Informe a rua/avenida do endereço de cobrança.');
        }
        if (!numeroStr) {
          throw new Error('Informe o número do endereço de cobrança.');
        }
        if (!cidade) {
          throw new Error('Informe a cidade do endereço de cobrança.');
        }
        if (!uf || uf.length !== 2) {
          throw new Error('Informe a UF (estado) do endereço de cobrança (2 letras).');
        }

        payerData.address = {
          zip_code: cepDigits,
          street_name: rua,
          street_number: numero,
          city: cidade,
          federal_unit: uf,
          ...(billingBairro ? { neighborhood: String(billingBairro).trim() } : {}),
        };
      }

      // ✅ VALIDAÇÃO FINAL: Garantir que payment_method_id e issuer_id estão presentes ANTES de enviar
      if (method === 'credit_card') {
        if (!cardPaymentMethodId) {
          throw new Error('payment_method_id é obrigatório para pagamento com cartão. Não foi possível obter da API.');
        }
        if (!cardIssuerId) {
          throw new Error('issuer_id é obrigatório para pagamento com cartão. Não foi possível obter da API.');
        }
        if (!cardToken) {
          throw new Error('Token do cartão é obrigatório para pagamento com cartão.');
        }
      }

      // ✅ Usar URL direta da Netlify Function (sem redirect)
      const createPaymentUrl = '/.netlify/functions/mercadopago-create-payment';

      const paymentResponse = await fetch(createPaymentUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          establishmentId,
          amount: amountInCents,
          description: `Agendamento #${appointmentId}`,
          payer: payerData,
          // ✅ CRÍTICO: Usar APENAS os dados retornados pela API de tokenização
          // ✅ REMOVIDO COMPLETAMENTE: Nunca usar 'credit_card' hardcoded
          // payment_method_id DEVE ser: visa, master, elo, etc. (vem da API)
          payment_method_id: method === 'credit_card' 
            ? cardPaymentMethodId // ✅ OBRIGATÓRIO: visa, master, elo, etc. (NUNCA 'credit_card')
            : method,
          ...(method === 'credit_card' ? {
            token: cardToken, // ✅ OBRIGATÓRIO
            issuer_id: cardIssuerId, // ✅ OBRIGATÓRIO
            installments: cardInstallments, // ✅ Usar valor padrão ou da API
          } : {}),
          metadata: {
            appointment_id: appointmentId,
            establishment_id: establishmentId,
          },
        }),
      });

      if (!paymentResponse.ok) {
        const errorData = await paymentResponse.json().catch(() => ({ message: 'Erro desconhecido' }));
        throw new Error(errorData.userMessage || errorData.error || `Erro ${paymentResponse.status}`);
      }

      const paymentResult = await paymentResponse.json();

      // Salvar transaction_id no Supabase
      try {
        if (paymentResult?.id) {
          await supabase
            .from('appointments')
            .update({
              payment_transaction_id: String(paymentResult.id),
              payment_method: method === 'pix' ? 'pix' : 'credito',
              ...(method === 'pix' ? { pix_payment_status: 'enviado' } : {}),
            })
            .eq('id', appointmentId);
        }
      } catch (e) {
        console.warn('⚠️ Não foi possível salvar payment_transaction_id:', e);
      }

      // Se for PIX, mostrar QR Code
      if (method === 'pix') {
        const qrCode = (paymentResult as any).point_of_interaction?.transaction_data?.qr_code;
        const qrCodeBase64 = (paymentResult as any).point_of_interaction?.transaction_data?.qr_code_base64;
        
        if (qrCode) {
          // Limpar interval anterior se existir
          if (pixCountdownIntervalRef.current) {
            window.clearInterval(pixCountdownIntervalRef.current);
            pixCountdownIntervalRef.current = null;
          }
          
          setPixQrCode(qrCode);
          setPixQrCodeUrl(qrCodeBase64 ? `data:image/png;base64,${qrCodeBase64}` : '');
          setPixExpiresInSeconds(90);
          setPixRemainingSeconds(90);
          setIsCheckingPayment(true);
          isCheckingPaymentRef.current = true;
          currentPaymentIdRef.current = paymentResult.id;
          
          // Iniciar contador imediatamente
          pixCountdownIntervalRef.current = window.setInterval(() => {
            setPixRemainingSeconds((prev) => {
              const newValue = Math.max(0, prev - 1);
              if (newValue === 0 && pixCountdownIntervalRef.current) {
                window.clearInterval(pixCountdownIntervalRef.current);
                pixCountdownIntervalRef.current = null;
              }
              return newValue;
            });
          }, 1000);
          
          checkMercadoPagoPaymentStatus(paymentResult.id);
          setIsProcessing(false);
        } else if (paymentResult.status === 'approved' || paymentResult.status === 'authorized') {
          await confirmAppointment(String(paymentResult.id));
        } else {
          toast('Pagamento processado. Aguardando confirmação...', 'warning');
          setIsCheckingPayment(true);
          isCheckingPaymentRef.current = true;
          currentPaymentIdRef.current = paymentResult.id;
          checkMercadoPagoPaymentStatus(paymentResult.id);
          setIsProcessing(false);
        }
      } else {
        // Cartão de crédito: verificar status imediatamente
        if (paymentResult.status === 'approved' || paymentResult.status === 'authorized') {
          await confirmAppointment(String(paymentResult.id));
        } else if (paymentResult.status === 'rejected' || paymentResult.status === 'cancelled') {
          toast(`Pagamento ${paymentResult.status_detail || 'recusado'}`, 'error');
          setIsProcessing(false);
        } else {
          toast('Pagamento processado. Aguardando confirmação...', 'warning');
          setIsCheckingPayment(true);
          checkMercadoPagoPaymentStatus(paymentResult.id);
          setIsProcessing(false);
        }
      }
    } catch (error: any) {
      console.error('❌ Erro ao processar pagamento Mercado Pago:', error);
      toast(`Erro ao processar pagamento: ${error.message}`, 'error');
      setIsProcessing(false);
      setIsCheckingPayment(false);
    }
  };

  // Verificar status do pagamento Mercado Pago periodicamente
  const checkMercadoPagoPaymentStatus = async (paymentId: number) => {
    // ✅ Se pagamento é obrigatório, reduzir tempo de espera para cancelar mais rápido
    const maxAttempts = cancelAppointmentOnFailure ? 24 : 60; // 2 minutos se obrigatório, 5 minutos se opcional
    let attempts = 0;

    const checkStatus = async () => {
      // Usar ref para verificar se ainda está checando (evita race conditions)
      if (attempts >= maxAttempts || !isCheckingPaymentRef.current || currentPaymentIdRef.current !== paymentId) {
        if (currentPaymentIdRef.current === paymentId) {
          setIsCheckingPayment(false);
          isCheckingPaymentRef.current = false;
          currentPaymentIdRef.current = null;
        }
        if (attempts >= maxAttempts) {
          toast('Tempo limite de pagamento excedido', 'error');
          setHasPagarMeError(true);
          // ✅ Se pagamento é obrigatório, cancelar agendamento imediatamente
          if (cancelAppointmentOnFailure) {
            console.log('❌ Pagamento obrigatório expirou (Mercado Pago), cancelando agendamento...');
            await cancelAppointment();
            onPaymentFailure();
          }
        }
        return;
      }

      try {
        const checkStatusUrl = import.meta.env.PROD
          ? `/.netlify/functions/mercadopago-check-status?paymentId=${paymentId}&establishmentId=${establishmentId}`
          : `/api/mercadopago/check-status?paymentId=${paymentId}&establishmentId=${establishmentId}`;

        console.log('🔄 [MP] Verificando status do pagamento:', paymentId, 'Tentativa:', attempts + 1);
        
        const response = await fetch(checkStatusUrl);
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Erro ${response.status}: ${errorText}`);
        }

        const payment = await response.json();
        console.log('📊 [MP] Status do pagamento:', payment.status, payment);

        // Mercado Pago: status pode ser 'approved', 'authorized', 'pending', 'rejected', 'cancelled', 'refunded'
        if (payment.status === 'approved' || payment.status === 'authorized') {
          console.log('✅ [MP] Pagamento aprovado!');
          // Limpar interval do contador
          if (pixCountdownIntervalRef.current) {
            window.clearInterval(pixCountdownIntervalRef.current);
            pixCountdownIntervalRef.current = null;
          }
          setIsCheckingPayment(false);
          isCheckingPaymentRef.current = false;
          currentPaymentIdRef.current = null;
          await confirmAppointment(String(paymentId));
        } else if (payment.status === 'rejected' || payment.status === 'cancelled' || payment.status === 'refunded') {
          console.log('❌ [MP] Pagamento recusado/cancelado');
          if (pixCountdownIntervalRef.current) {
            window.clearInterval(pixCountdownIntervalRef.current);
            pixCountdownIntervalRef.current = null;
          }
          setIsCheckingPayment(false);
          isCheckingPaymentRef.current = false;
          currentPaymentIdRef.current = null;
          toast('Pagamento recusado ou cancelado', 'error');
          setHasPagarMeError(true);
          // ✅ Se pagamento é obrigatório, cancelar agendamento imediatamente
          if (cancelAppointmentOnFailure) {
            console.log('❌ Pagamento obrigatório recusado (Mercado Pago), cancelando agendamento...');
            await cancelAppointment();
            onPaymentFailure();
          }
        } else {
          // Continuar verificando (pending, in_process, etc)
          console.log('⏳ [MP] Pagamento ainda pendente, verificando novamente em 5s...');
          attempts++;
          setTimeout(checkStatus, 5000); // Verificar a cada 5 segundos
        }
      } catch (error: any) {
        console.error('❌ [MP] Erro ao verificar status:', error);
        attempts++;
        // Continuar tentando mesmo com erro (pode ser temporário)
        if (isCheckingPaymentRef.current && currentPaymentIdRef.current === paymentId) {
          setTimeout(checkStatus, 5000);
        }
      }
    };

    checkStatus();
  };

  const handlePayment = async (method: PaymentMethod) => {
    if (!method) return;

    // CPF/CNPJ costuma ser exigido na Pagar.me (PIX e cartão)
    const docDigits = String(cpfCliente || '').replace(/\D/g, '');
    if (!(docDigits.length === 11 || docDigits.length === 14)) {
      toast('Informe um CPF (11) ou CNPJ (14) válido para continuar.', 'error');
      return;
    }

    // ✅ IMPORTANTE: sem isso o modal não muda de tela (fica preso na seleção)
    setSelectedMethod(method);
    setIsProcessing(true);
    setPixQrCode('');
    setPixQrCodeUrl('');
    // limpar banner de fallback quando tentar pagar de novo
    setCardRefusedReason('');
    setHasPagarMeError(false); // Limpar erro anterior ao tentar novamente

    try {
      // Se for cartão, tokenizar no FRONTEND (pk_ via /tokens?appId=...)
      let cardToken: string | undefined = undefined;
      let billingAddress: any = undefined;
      if (method === 'credit_card' || method === 'debit_card') {
        const numberDigits = String(cardNumber || '').replace(/\D/g, '');
        const expMonthDigits = String(cardExpMonth || '').replace(/\D/g, '');
        const expYearDigits = String(cardExpYear || '').replace(/\D/g, '');
        const cvvDigits = String(cardCvv || '').replace(/\D/g, '');
        const holder = String(cardHolderName || '').trim();

        if (numberDigits.length < 13 || numberDigits.length > 19) {
          toast('Número do cartão inválido.', 'error');
          setIsProcessing(false);
          return;
        }
        const monthNum = Number(expMonthDigits);
        if (!Number.isFinite(monthNum) || monthNum < 1 || monthNum > 12) {
          toast('Mês de validade inválido (1 a 12).', 'error');
          setIsProcessing(false);
          return;
        }
        if (!expYearDigits || expYearDigits.length < 2) {
          toast('Ano de validade inválido.', 'error');
          setIsProcessing(false);
          return;
        }
        if (cvvDigits.length < 3 || cvvDigits.length > 4) {
          toast('CVV inválido.', 'error');
          setIsProcessing(false);
          return;
        }
        if (!holder) {
          toast('Informe o nome do titular do cartão.', 'error');
          setIsProcessing(false);
          return;
        }

        const cepDigits = String(billingCep || '').replace(/\D/g, '');
        const uf = String(billingUf || '').trim().toUpperCase();
        const cidade = String(billingCidade || '').trim();
        const rua = String(billingRua || '').trim();
        const numero = String(billingNumero || '').trim();
        const bairro = String(billingBairro || '').trim();

        if (cepDigits.length !== 8) {
          toast('Informe um CEP válido (8 dígitos) para o endereço de cobrança.', 'error');
          setIsProcessing(false);
          return;
        }
        if (!rua || !numero) {
          toast('Informe rua e número do endereço de cobrança.', 'error');
          setIsProcessing(false);
          return;
        }
        if (!cidade) {
          toast('Informe a cidade do endereço de cobrança.', 'error');
          setIsProcessing(false);
          return;
        }
        if (!uf || uf.length !== 2) {
          toast('Informe a UF do endereço de cobrança (2 letras, ex: SC).', 'error');
          setIsProcessing(false);
          return;
        }

        billingAddress = {
          line_1: bairro ? `${rua}, ${numero} - ${bairro}` : `${rua}, ${numero}`,
          zip_code: cepDigits,
          city: cidade,
          state: uf,
          country: 'BR',
        };

        cardToken = await criarTokenCartaoPagarme({
          number: numberDigits,
          holder_name: holder,
          exp_month: String(monthNum).padStart(2, '0'),
          exp_year: expYearDigits,
          cvv: cvvDigits,
          holder_document: docDigits,
        });
      }

      // Timeout no frontend para não ficar preso se o servidor travar
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 25000);

      // Criar pagamento na Pagar.me via API Route
      const createPaymentUrl = import.meta.env.PROD
        ? '/.netlify/functions/pagarme-create-payment'
        : '/api/pagarme/create-payment';

      const paymentResponse = await fetch(createPaymentUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          amount: amountInCents, // Valor já em centavos
          payment_method: method,
          ...(cardToken ? { card_token: cardToken } : {}),
          ...(billingAddress ? { billing_address: billingAddress } : {}),
          customer: {
            name: customerData.name,
            email: customerData.email,
            document: docDigits,
            phone: customerData.phone,
          },
          ...(recipientId ? {
            split_rules: [
              {
                recipient_id: recipientId,
                amount: amountInCents, // Backend aplica split (R$ 1,00 plataforma + resto estabelecimento)
                type: 'flat',
                liable: true,
                charge_processing_fee: false
              }
            ]
          } : {}),
          metadata: {
            appointment_id: appointmentId,
            establishment_id: establishmentId
          }
        }),
      });

      window.clearTimeout(timeoutId);

      if (!paymentResponse.ok) {
        const errorData = await paymentResponse.json().catch(() => ({ message: 'Erro desconhecido' }));
        const msg =
          errorData.userMessage ||
          errorData.error ||
          `Erro ${paymentResponse.status}`;
        throw new Error(msg);
      }

      const paymentResult = await paymentResponse.json();

      // ✅ Importante: persistir o ID da transação no Supabase assim que o pagamento é criado.
      // Isso evita perder referência caso o usuário feche/recarregue a página antes da confirmação,
      // e permite reconciliação futura.
      try {
        if (paymentResult?.id) {
          const methodToStore =
            method === 'pix' ? 'pix' : method === 'credit_card' ? 'credito' : 'debito';
          await supabase
            .from('appointments')
            .update({
              payment_transaction_id: paymentResult.id,
              // Salvar método escolhido no agendamento para consistência
              payment_method: methodToStore,
              // se for PIX, deixar explícito que foi iniciado via Pagar.me
              ...(method === 'pix' ? { pix_payment_status: 'enviado' } : {}),
            })
            .eq('id', appointmentId);
        }
      } catch (e) {
        // Não bloquear o fluxo de pagamento por falha de log; apenas registrar.
        console.warn('⚠️ Não foi possível salvar payment_transaction_id no Supabase:', e);
      }

      // Se for PIX, mostrar QR Code
      if (method === 'pix' && paymentResult.pix?.qr_code) {
        setPixQrCode(paymentResult.pix.qr_code);
        setPixQrCodeUrl(paymentResult.pix.qr_code_url || '');
        const expiresIn = Number(paymentResult.pix?.expires_in || 90);
        const safeExpiresIn = Number.isFinite(expiresIn) && expiresIn > 0 ? Math.floor(expiresIn) : 90;
        setPixExpiresInSeconds(safeExpiresIn);
        setPixRemainingSeconds(safeExpiresIn);

        // Iniciar verificação de pagamento
        setIsCheckingPayment(true);
        checkPaymentStatusPeriodically(paymentResult.id);
        setIsProcessing(false);
      } else if (paymentResult.status === 'paid' || paymentResult.status === 'authorized') {
        // Pagamento aprovado imediatamente (cartão)
        await confirmAppointment(paymentResult.id);
      } else {
        toast('Pagamento processado. Aguardando confirmação...', 'warning');
        // Verificar status periodicamente
        setIsCheckingPayment(true);
        checkPaymentStatusPeriodically(paymentResult.id);
        setIsProcessing(false);
      }
    } catch (error: any) {
      console.error('❌ Erro ao processar pagamento:', error);
      const isAbort = error?.name === 'AbortError';
      toast(
        isAbort
          ? 'O servidor de pagamentos demorou demais para responder. Tente novamente.'
          : `Erro ao processar pagamento: ${error.message}`,
        'error'
      );
      setIsProcessing(false);
      setIsCheckingPayment(false);
      setSelectedMethod(null);
      setHasPagarMeError(true); // Marcar que houve erro no Pagar.me
      // Não chamar onPaymentFailure() aqui - deixar o usuário tentar com Mercado Pago
    }
  };

  // Countdown do PIX (expira e encerra fluxo)
  useEffect(() => {
    // limpar interval anterior
    if (pixCountdownIntervalRef.current) {
      window.clearInterval(pixCountdownIntervalRef.current);
      pixCountdownIntervalRef.current = null;
    }

    if (!pixQrCode || !isCheckingPayment || pixRemainingSeconds <= 0) return;

    pixCountdownIntervalRef.current = window.setInterval(() => {
      setPixRemainingSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      if (pixCountdownIntervalRef.current) {
        window.clearInterval(pixCountdownIntervalRef.current);
        pixCountdownIntervalRef.current = null;
      }
    };
  }, [pixQrCode, isCheckingPayment, pixRemainingSeconds]);

  useEffect(() => {
    // Quando zerar, expirar
    if (!pixQrCode) return;
    if (!isCheckingPayment) return;
    if (pixRemainingSeconds > 0) return;

    const handleExpire = async () => {
      try {
        setIsCheckingPayment(false);
        toast('⏳ Tempo do PIX expirou. Gere novamente para pagar.', 'warning');
        if (cancelAppointmentOnFailure) {
          await cancelAppointment();
        } else {
          await markAppointmentPaymentUnpaid();
        }
      } finally {
        onPaymentFailure();
        onClose();
      }
    };

    handleExpire();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pixRemainingSeconds, pixQrCode, isCheckingPayment]);

  const formatMMSS = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const checkPaymentStatusPeriodically = async (transactionId: string) => {
    // ✅ Se pagamento é obrigatório, reduzir tempo de espera para cancelar mais rápido
    // Se opcional, dar mais tempo (5 minutos). Se obrigatório, cancelar em 2 minutos (24 tentativas * 5s)
    const maxAttempts = cancelAppointmentOnFailure ? 24 : 60; // 2 minutos se obrigatório, 5 minutos se opcional
    let attempts = 0;

    const checkInterval = setInterval(async () => {
      attempts++;

      try {
        // Chamar API Route para verificar status
        const checkStatusUrl = import.meta.env.PROD
          ? `/.netlify/functions/pagarme-check-status?orderId=${transactionId}`
          : `/api/pagarme/check-status?orderId=${transactionId}`;

        const statusResponse = await fetch(checkStatusUrl);

        if (!statusResponse.ok) {
          throw new Error('Erro ao verificar status');
        }

        const { status, reason } = await statusResponse.json();

        const normalized = String(status || '').toLowerCase();
        if (normalized === 'paid' || normalized === 'authorized') {
          clearInterval(checkInterval);
          setIsCheckingPayment(false);
          await confirmAppointment(transactionId);
        } else if (
          normalized === 'refused' ||
          normalized === 'pending_refund' ||
          normalized === 'failed' ||
          normalized === 'canceled' ||
          normalized === 'cancelled' ||
          normalized === 'voided'
        ) {
          clearInterval(checkInterval);
          setIsCheckingPayment(false);
          const reasonStr = String(reason || '');

          // ✅ Qualquer recusa no cartão -> oferecer PIX sem zerar o atendimento
          if (selectedMethod === 'credit_card' || selectedMethod === 'debit_card') {
            setCardRefusedReason(reasonStr || 'Pagamento no cartão recusado');
            toast('Pagamento no cartão recusado. Você pode pagar via PIX sem refazer o agendamento.', 'warning');
            await markAppointmentPaymentUnpaid(); // nunca cancela aqui
            setIsProcessing(false);
            setSelectedMethod(null); // volta para seleção e mostra botão PIX
            return;
          }

          toast(
            reasonStr ? `Pagamento recusado/cancelado: ${reasonStr}` : 'Pagamento recusado ou cancelado',
            'error'
          );
          // ✅ Se pagamento é obrigatório, cancelar agendamento imediatamente
          if (cancelAppointmentOnFailure) {
            console.log('❌ Pagamento obrigatório recusado/falhou, cancelando agendamento...');
            await cancelAppointment();
          } else {
            // Se pagamento é opcional, apenas marcar como não pago
            await markAppointmentPaymentUnpaid();
          }
          onPaymentFailure();
        } else if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          setIsCheckingPayment(false);
          toast('Tempo limite de pagamento excedido', 'error');
          // ✅ Se pagamento é obrigatório, cancelar agendamento imediatamente
          if (cancelAppointmentOnFailure) {
            console.log('❌ Pagamento obrigatório falhou/expirou, cancelando agendamento...');
            await cancelAppointment();
          } else {
            await markAppointmentPaymentUnpaid();
          }
          onPaymentFailure();
        }
      } catch (error: any) {
        console.error('❌ Erro ao verificar status do pagamento:', error);
        if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          setIsCheckingPayment(false);
          if (cancelAppointmentOnFailure) {
            await cancelAppointment();
          } else {
            await markAppointmentPaymentUnpaid();
          }
          onPaymentFailure();
        }
      }
    }, 5000); // Verificar a cada 5 segundos
  };

  const markAppointmentPaymentUnpaid = async () => {
    try {
      await supabase
        .from('appointments')
        .update({
          payment_status: 'unpaid',
        })
        .eq('id', appointmentId);
    } catch (error) {
      console.error('❌ Erro ao marcar pagamento como unpaid:', error);
    }
  };

  const confirmAppointment = async (transactionId: string) => {
    try {
      const methodToStore =
        selectedMethod === 'pix'
          ? 'pix'
          : selectedMethod === 'credit_card'
            ? 'credito'
            : selectedMethod === 'debit_card'
              ? 'debito'
              : 'pix';

      // Atualizar agendamento como confirmado
      const { error } = await supabase
        .from('appointments')
        .update({
          status: 'confirmed',
          payment_status: 'paid',
          payment_transaction_id: transactionId,
          payment_method: methodToStore,
          ...(methodToStore === 'pix' ? { pix_payment_status: 'confirmado' } : {}),
        })
        .eq('id', appointmentId);

      if (error) {
        console.error('❌ Erro ao confirmar agendamento:', error);
        toast('Erro ao confirmar agendamento', 'error');
        return;
      }

      toast('Pagamento confirmado! Agendamento realizado com sucesso.', 'success');
      setIsProcessing(false);

      // Buscar telefone do agendamento para redirecionamento
      const { data: appointmentData } = await supabase
        .from('appointments')
        .select('client_whatsapp')
        .eq('id', appointmentId)
        .single();

      // Passar telefone para o callback de sucesso
      onPaymentSuccess(appointmentData?.client_whatsapp || '');
      onClose();
    } catch (error: any) {
      console.error('❌ Erro ao confirmar agendamento:', error);
      toast('Erro ao confirmar agendamento', 'error');
    }
  };

  const cancelAppointment = async () => {
    try {
      // Cancelar agendamento
      const { error } = await supabase
        .from('appointments')
        .update({
          status: 'cancelled',
          payment_status: 'failed'
        })
        .eq('id', appointmentId);

      if (error) {
        console.error('❌ Erro ao cancelar agendamento:', error);
      }
    } catch (error: any) {
      console.error('❌ Erro ao cancelar agendamento:', error);
    }
  };

  if (!isOpen) return null;

  // ✅ Prevenir scroll da página de trás quando modal está aberto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isProcessing && !isCheckingPayment) {
          onClose();
        }
      }}
    >
      <div className="bg-[#1a1b1c] rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] min-h-[50vh] flex flex-col my-auto border border-gray-700">
        {/* Header fixo */}
        <div className="flex items-center justify-between p-6 pb-4 flex-shrink-0 border-b border-gray-800/50">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <CreditCard className="h-6 w-6" />
            Pagamento Antecipado
          </h2>
          {!isProcessing && !isCheckingPayment && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-700 rounded-full transition-colors"
            >
              <X className="h-5 w-5 text-gray-400" />
            </button>
          )}
        </div>

        {/* Conteúdo com scroll */}
        <div className="flex-1 overflow-y-auto px-6 pb-6" style={{ minHeight: 0, WebkitOverflowScrolling: 'touch' }}>
          {!selectedMethod ? (
          <div className="space-y-4">
            {cardRefusedReason ? (
              <div className="bg-red-900/30 border border-red-700/60 rounded-lg p-4">
                <p className="text-sm text-red-200 font-semibold">
                  Pagamento no cartão recusado
                </p>
                <p className="text-xs text-red-200/90 mt-1">
                  {cardRefusedReason}
                </p>
                <button
                  onClick={() => handlePayment('pix')}
                  className="w-full mt-3 px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-extrabold transition-colors"
                >
                  Pagar com PIX agora (sem refazer)
                </button>
              </div>
            ) : null}


            <div className="bg-blue-600/20 border border-blue-500/50 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-300">
                💳 {cancelAppointmentOnFailure
                  ? <>Para confirmar seu agendamento, é necessário realizar o pagamento antecipado de <strong>R$ {amount.toFixed(2)}</strong>.</>
                  : <>Parabéns pelo agendamento! Quer pagar agora <strong>R$ {amount.toFixed(2)}</strong> e já <strong>deixar seu barbeiro feliz</strong>?</>
                }
              </p>
            </div>

            <div className="bg-[#2a2b2c] border border-gray-700 rounded-lg p-4">
              <label className="block text-sm text-gray-300 mb-2">CPF/CNPJ do pagador (obrigatório para PIX e cartão)</label>
              <input
                value={cpfCliente}
                onChange={(e) => setCpfCliente(e.target.value)}
                placeholder="Somente números (CPF 11 / CNPJ 14)"
                className="w-full px-3 py-2 rounded-md bg-[#1a1b1c] border border-gray-600 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                inputMode="numeric"
              />
              <p className="text-xs text-gray-400 mt-2">
                {hasMercadoPago 
                  ? 'O Mercado Pago exige CPF/CNPJ para pagamentos (principalmente PIX e cartão).'
                  : 'A Pagar.me costuma exigir CPF/CNPJ para pagamentos (principalmente PIX e cartão).'}
              </p>
            </div>

            {/* ✅ NOVO: Campo de email (obrigatório para Mercado Pago) */}
            {hasMercadoPago && (
              <div className="bg-[#2a2b2c] border border-gray-700 rounded-lg p-4">
                <label className="block text-sm text-gray-300 mb-2">
                  Email do pagador <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  value={payerEmail}
                  onChange={(e) => setPayerEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full px-3 py-2 rounded-md bg-[#1a1b1c] border border-gray-600 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  inputMode="email"
                />
                <p className="text-xs text-gray-400 mt-2">
                  O Mercado Pago exige um email válido para processar o pagamento.
                </p>
              </div>
            )}

            <div className="space-y-3">
              {/* Mostrar opções do Pagar.me apenas se NÃO tiver Mercado Pago */}
              {!hasMercadoPago && (
                <>
                  <button
                    onClick={() => handlePayment('pix')}
                    className="w-full p-4 bg-[#2a2b2c] border border-gray-600 rounded-lg hover:border-blue-500 transition-colors flex items-center gap-3"
                  >
                    <QrCode className="h-6 w-6 text-blue-400" />
                    <div className="flex-1 text-left">
                      <div className="text-white font-medium">PIX</div>
                      <div className="text-sm text-gray-400">Aprovação imediata (Pagar.me)</div>
                    </div>
                  </button>

                  <button
                    onClick={() => setSelectedMethod('credit_card')}
                    className="w-full p-4 bg-[#2a2b2c] border border-gray-600 rounded-lg hover:border-green-500 transition-colors flex items-center gap-3"
                  >
                    <Wallet className="h-6 w-6 text-green-400" />
                    <div className="flex-1 text-left">
                      <div className="text-white font-medium">Cartão de Crédito</div>
                      <div className="text-sm text-gray-400">Tokenização segura (Pagar.me)</div>
                    </div>
                  </button>
                </>
              )}

              {/* Mostrar opções do Mercado Pago apenas se tiver Mercado Pago conectado */}
              {hasMercadoPago && (
                <>
                  <button
                    onClick={() => handleMercadoPagoPayment('pix')}
                    disabled={isProcessing || isCheckingPayment}
                    className="w-full p-4 bg-[#2a2b2c] border border-[#009EE3] rounded-lg hover:border-[#0088C7] transition-colors flex items-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <QrCode className="h-6 w-6 text-[#009EE3]" />
                    <div className="flex-1 text-left">
                      <div className="text-white font-medium">PIX</div>
                      <div className="text-sm text-gray-400">Aprovação imediata (Mercado Pago)</div>
                    </div>
                  </button>

                  <button
                    onClick={() => setSelectedMethod('credit_card')}
                    disabled={isProcessing || isCheckingPayment}
                    className="w-full p-4 bg-[#2a2b2c] border border-[#009EE3] rounded-lg hover:border-[#0088C7] transition-colors flex items-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <CreditCard className="h-6 w-6 text-[#009EE3]" />
                    <div className="flex-1 text-left">
                      <div className="text-white font-medium">Cartão de Crédito</div>
                      <div className="text-sm text-gray-400">Via Mercado Pago</div>
                    </div>
                  </button>
                </>
              )}
            </div>
          </div>
        ) : selectedMethod === 'credit_card' && !pixQrCode ? (
          <div className="space-y-4">
            <div className={`${hasMercadoPago ? 'bg-[#009EE3]/10 border-[#009EE3]/30' : 'bg-green-600/10 border-green-500/30'} border rounded-lg p-3`}>
              <p className={`text-sm ${hasMercadoPago ? 'text-[#009EE3]' : 'text-green-200'}`}>
                {hasMercadoPago 
                  ? 'Preencha os dados do cartão. O pagamento será processado via Mercado Pago.'
                  : 'Preencha os dados do cartão. O sistema gera um <strong>token</strong> e não envia o número do cartão para o servidor.'}
              </p>
            </div>

            <div className="space-y-3">
              <div className="bg-[#2a2b2c] border border-gray-700 rounded-lg p-4">
                <label className="block text-sm text-gray-300 mb-2">CPF/CNPJ do pagador (obrigatório)</label>
                <input
                  value={cpfCliente}
                  onChange={(e) => setCpfCliente(e.target.value)}
                  placeholder="Somente números (CPF 11 / CNPJ 14)"
                  className="w-full px-3 py-2 rounded-md bg-[#1a1b1c] border border-gray-600 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                  inputMode="numeric"
                />
              </div>

              {/* ✅ REORGANIZADO: Endereço de cobrança ANTES do cartão (melhor UX) */}
              <div className="mt-2 border-t border-gray-800 pt-3 space-y-3">
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
              <div className="mb-4 mt-4 border-t border-gray-800 pt-4">
                <label className="block text-sm text-gray-300 mb-2">Dados do cartão</label>
                {/* ✅ Mensagem informativa sobre segurança */}
                <div className="bg-blue-900/20 border border-blue-700/40 rounded-lg p-2.5 mb-3">
                  <p className="text-xs text-blue-200/90">
                    <span className="font-semibold">ℹ️ Por segurança:</span> Os dados do cartão (número, validade, CVV) não são salvos. 
                    Se você sair e voltar, precisará preencher novamente. Seu endereço e email são salvos automaticamente.
                  </p>
                </div>
                {hasMercadoPago ? (() => {
                  const docDigitsForBrick = String(cpfCliente || '').replace(/\D/g, '');
                  const identificationTypeForBrick = docDigitsForBrick.length === 11 ? 'CPF' : 'CNPJ';
                  
                  return (
                    <CardPaymentBrick
                      publicKey={String(import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY || '').trim()}
                      amount={amount}
                      onSubmit={handleBrickSubmit}
                      onReady={handleBrickReady}
                      onError={handleBrickError}
                      payerData={{
                        email: payerEmail?.trim() || customerData.email?.trim() || '',
                        identificationType: identificationTypeForBrick,
                        identificationNumber: docDigitsForBrick,
                        firstName: customerData.name?.split(' ')[0] || '',
                        lastName: customerData.name?.split(' ').slice(1).join(' ') || customerData.name || '',
                      }}
                    />
                  );
                })() : (
                  <>
                    {/* ✅ Pagar.me ainda usa inputs manuais (não tem Brick) */}
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">Número do cartão</label>
                      <input
                        value={cardNumber || ''}
                        onChange={(e) => setCardNumber(e.target.value)}
                        className="w-full px-3 py-2 rounded-md bg-[#111213] border border-gray-700 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="0000 0000 0000 0000"
                        inputMode="numeric"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-gray-300 mb-1">Nome do titular</label>
                      <input
                        value={cardHolderName || ''}
                        onChange={(e) => setCardHolderName(e.target.value)}
                        className="w-full px-3 py-2 rounded-md bg-[#111213] border border-gray-700 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="Como está no cartão"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-1">
                        <label className="block text-sm text-gray-300 mb-1">Mês</label>
                        <input
                          value={cardExpMonth || ''}
                          onChange={(e) => setCardExpMonth(e.target.value)}
                          className="w-full px-3 py-2 rounded-md bg-[#111213] border border-gray-700 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                          placeholder="MM"
                          inputMode="numeric"
                        />
                      </div>
                      <div className="col-span-1">
                        <label className="block text-sm text-gray-300 mb-1">Ano</label>
                        <input
                          value={cardExpYear || ''}
                          onChange={(e) => setCardExpYear(e.target.value)}
                          className="w-full px-3 py-2 rounded-md bg-[#111213] border border-gray-700 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                          placeholder="AA ou AAAA"
                          inputMode="numeric"
                        />
                      </div>
                      <div className="col-span-1">
                        <label className="block text-sm text-gray-300 mb-1">CVV</label>
                        <input
                          value={cardCvv || ''}
                          onChange={(e) => setCardCvv(e.target.value)}
                          className="w-full px-3 py-2 rounded-md bg-[#111213] border border-gray-700 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                          placeholder="123"
                          inputMode="numeric"
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => handlePayment('credit_card')}
                      disabled={isProcessing || isCheckingPayment}
                      className="w-full mt-4 px-4 py-3 rounded-lg text-white font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        `Pagar com Cartão (R$ ${amount.toFixed(2)}) - Pagar.me`
                      )}
                    </button>
                  </>
                )}
              </div>

              {/* ✅ REMOVIDO: Botão manual de pagamento para Mercado Pago (agora o Brick tem seu próprio botão) */}
              {/* O Card Payment Brick já inclui o botão de pagamento integrado */}
              {/* Botão do Pagar.me já está dentro do bloco acima (dentro do CardPaymentBrick quando !hasMercadoPago) */}

              <button
                type="button"
                onClick={() => setSelectedMethod(null)}
                disabled={isProcessing || isCheckingPayment}
                className="w-full px-4 py-2 rounded-lg bg-[#2a2b2c] hover:bg-[#343536] text-white font-semibold transition-colors border border-gray-700 disabled:opacity-60"
              >
                Voltar
              </button>
            </div>
          </div>
        ) : pixQrCode ? (
          <div className="space-y-4">
            <div className="bg-green-600/20 border border-green-500/50 rounded-lg p-4 mb-6">
              <p className="text-sm text-green-300 text-center">
                Escaneie o QR Code abaixo para pagar via PIX
              </p>
              <p className="text-xs text-green-200/90 text-center mt-2">
                ⏱️ Tempo para pagar: <span className="font-bold">{formatMMSS(pixRemainingSeconds || pixExpiresInSeconds)}</span>
              </p>
            </div>

            <div className="flex justify-center mb-4">
              {pixQrCodeUrl ? (
                <div className="bg-white p-4 rounded-lg">
                  <img src={pixQrCodeUrl} alt="QR Code PIX" className="w-64 h-64" />
                </div>
              ) : null}
            </div>

            {/* PIX Copia e Cola (sempre que existir qr_code) */}
            <div className="w-full">
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
                    toast('Código PIX copiado!', 'success');
                  } catch {
                    toast('Não foi possível copiar. Selecione e copie manualmente.', 'warning');
                  }
                }}
                className="w-full mt-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
              >
                COPIAR CÓDIGO PIX
              </button>
            </div>

            {isCheckingPayment && (
              <div className="flex items-center justify-center gap-2 text-blue-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Aguardando confirmação do pagamento...</span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-300 text-center">
              Processando pagamento...
            </p>
            {(isProcessing || isCheckingPayment) && (
              <div className="flex items-center justify-center gap-2 text-blue-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>{isCheckingPayment ? 'Aguardando confirmação do pagamento...' : 'Processando...'}</span>
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

