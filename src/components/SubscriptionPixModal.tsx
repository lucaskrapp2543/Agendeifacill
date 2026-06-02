import { CheckCircle2, CreditCard, Loader2, MessageCircle, QrCode, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { CardPaymentBrick } from './CardPaymentBrick';

const onlyDigits = (v: string) => String(v || '').replace(/\D/g, '');

// ✅ Validação de CPF/CNPJ (evita erro confuso do gateway)
const isValidCPF = (cpfRaw: string): boolean => {
  const cpf = onlyDigits(cpfRaw);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // 00000000000 etc
  const calc = (base: string, factor: number) => {
    let total = 0;
    for (let i = 0; i < base.length; i++) {
      total += Number(base[i]) * (factor - i);
    }
    const mod = total % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const d1 = calc(cpf.slice(0, 9), 10);
  const d2 = calc(cpf.slice(0, 10), 11);
  return cpf.endsWith(`${d1}${d2}`);
};

const isValidCNPJ = (cnpjRaw: string): boolean => {
  const cnpj = onlyDigits(cnpjRaw);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (base: string, weights: number[]) => {
    let sum = 0;
    for (let i = 0; i < weights.length; i++) {
      sum += Number(base[i]) * weights[i];
    }
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(cnpj.slice(0, 12), w1);
  const d2 = calc(cnpj.slice(0, 13), w2);
  return cnpj.endsWith(`${d1}${d2}`);
};

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
  // ✅ Link externo (custom_link): abre o mesmo modal e redireciona no final
  externalPaymentLink?: string;
  // ✅ Define qual fluxo abrir primeiro (ex.: pedido via WhatsApp, sem abrir WhatsApp direto)
  initialFlow?: 'default' | 'credit' | 'whatsapp';
  // ✅ Renovação: pré-preenche nome e WhatsApp do assinante (mesmo número = atualiza o registro existente ao pagar)
  initialPrefill?: { name: string; whatsapp: string };
  // ✅ Controle por assinatura (fallback true para compatibilidade com bases antigas)
  allowedPix?: boolean;
  allowedCard?: boolean;
};

type RecurringSetupDraft = {
  token?: string;
  deviceSessionId?: string;
  payer: {
    email: string;
    name: string;
    first_name: string;
    last_name: string;
    identification: { type: 'CPF' | 'CNPJ'; number: string };
    phone: { area_code: string; number: string };
    address: {
      zip_code: string;
      street_name: string;
      street_number: number;
      neighborhood?: string;
      city: string;
      federal_unit: string;
    };
  };
  customer: {
    name: string;
    whatsapp: string;
    email: string;
    document: string;
  };
  card: {
    payment_method_id: string;
    issuer_id: string;
    bin?: string;
    last_four_digits?: string;
  };
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
  externalPaymentLink,
  initialFlow = 'default',
  initialPrefill,
  allowedPix = true,
  allowedCard = true,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<'pix' | 'credit_card' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [pixQrCode, setPixQrCode] = useState('');
  const [pixQrCodeUrl, setPixQrCodeUrl] = useState('');
  const [isPaid, setIsPaid] = useState(false);
  const [currentPaymentId, setCurrentPaymentId] = useState<string>('');
  const [currentPaymentProvider, setCurrentPaymentProvider] = useState<
    'pagarme_pix' | 'pagarme_card' | 'mercadopago_pix' | 'mercadopago_card' | 'mercadopago_card_recurring' | ''
  >('');
  const [lastCheckError, setLastCheckError] = useState<string>('');
  const [cpf, setCpf] = useState('');
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [cardRefusedReason, setCardRefusedReason] = useState('');
  const countdownRef = useRef<number | null>(null);
  const statusIntervalRef = useRef<number | null>(null);
  const [expiresInSeconds, setExpiresInSeconds] = useState(90);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  // ✅ Verificar se Mercado Pago está configurado
  const [hasMercadoPago, setHasMercadoPago] = useState(false);

  // 💳 Cartão (externo): estados do fluxo
  const [showCreditConfirm, setShowCreditConfirm] = useState(false);
  const [showCreditInstructions, setShowCreditInstructions] = useState(false);
  const [hasOpenedCreditLink, setHasOpenedCreditLink] = useState(false);
  const [creditCardLink, setCreditCardLink] = useState<string>('');
  const [isCreditClaimed, setIsCreditClaimed] = useState(false);
  /** Endereço de cobrança usado no fluxo de cartão do Mercado Pago */
  const [billingCep, setBillingCep] = useState('');
  const [billingRua, setBillingRua] = useState('');
  const [billingNumero, setBillingNumero] = useState('');
  const [billingBairro, setBillingBairro] = useState('');
  const [billingCidade, setBillingCidade] = useState('');
  const [billingUf, setBillingUf] = useState('');

  // 🔗 Link externo (custom_link): estados do fluxo
  const [showExternalInstructions, setShowExternalInstructions] = useState(false);
  const [hasOpenedExternalLink, setHasOpenedExternalLink] = useState(false);
  const [isExternalClaimed, setIsExternalClaimed] = useState(false);

  // UX: auto-scroll para a seção do cartão dentro do modal
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const creditSectionRef = useRef<HTMLDivElement | null>(null);
  const creditActionsRef = useRef<HTMLDivElement | null>(null);
  const externalSectionRef = useRef<HTMLDivElement | null>(null);
  const externalActionsRef = useRef<HTMLDivElement | null>(null);
  const recurringSetupRef = useRef<RecurringSetupDraft | null>(null);
  const [recurringSetupUrl, setRecurringSetupUrl] = useState('');
  const [recurringSetupRequired, setRecurringSetupRequired] = useState(false);

  const scrollToEl = (el: HTMLElement | null) => {
    if (!el) return;
    const container = scrollContainerRef.current;
    if (!container) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const top =
      el.getBoundingClientRect().top -
      container.getBoundingClientRect().top +
      container.scrollTop -
      12;
    container.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  };

  // ✅ Renovação: pré-preenher nome e WhatsApp quando abrir com initialPrefill
  useEffect(() => {
    if (isOpen && initialPrefill) {
      if (initialPrefill.name) setNome(initialPrefill.name);
      const w = String(initialPrefill.whatsapp || '').replace(/\D/g, '');
      if (w) setWhatsapp(w);
    }
  }, [isOpen, initialPrefill?.name, initialPrefill?.whatsapp]);

  // ✅ Carregar email salvo ao abrir o modal
  useEffect(() => {
    if (isOpen && establishmentId) {
      try {
        const savedEmail = localStorage.getItem(`subscription_email_${establishmentId}`);
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

  // ✅ Salvar email quando mudar
  useEffect(() => {
    if (isOpen && establishmentId) {
      try {
        if (email && !email.includes('guest_') && !email.includes('@agendafaci')) {
          localStorage.setItem(`subscription_email_${establishmentId}`, email);
        }
      } catch (e) {
        console.warn('⚠️ Erro ao salvar dados:', e);
      }
    }
  }, [isOpen, establishmentId, email]);

  const amountInCents = Math.round(Number(subscription.value || 0) * 100);
  const isMonthlySubscription = Number(subscription.duration_months || 1) === 1;

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
    setShowCreditConfirm(false);
    setShowCreditInstructions(false);
    setHasOpenedCreditLink(false);
    setIsCreditClaimed(false);
    setBillingCep('');
    setBillingRua('');
    setBillingNumero('');
    setBillingBairro('');
    setBillingCidade('');
    setBillingUf('');
    setShowExternalInstructions(false);
    setHasOpenedExternalLink(false);
    setIsExternalClaimed(false);
    recurringSetupRef.current = null;
    setRecurringSetupUrl('');
    setRecurringSetupRequired(false);
  }, [isOpen]);

  // Buscar o link de cartão (externo) configurado para esta assinatura
  useEffect(() => {
    if (!isOpen) return;
    const sid = String(subscription?.id || '').trim();
    if (!sid) return;

    supabase
      .from('subscriptions')
      // coluna pode não existir em ambientes antigos; tratamos via try/catch no .then
      .select('credit_card_link')
      .eq('id', sid)
      .maybeSingle()
      .then(({ data }) => {
        const link = String((data as any)?.credit_card_link || '').trim();
        setCreditCardLink(link);
      })
      .catch(() => {
        setCreditCardLink('');
      });
  }, [isOpen, subscription?.id]);

  const externalLink = String(externalPaymentLink || '').trim();
  const canPixInfra =
    hasMercadoPago || (paymentProvider !== 'mercadopago' && Boolean(String(recipientId || '').trim()));
  const canPix = Boolean(allowedPix) && canPixInfra;
  const canCard = Boolean(allowedCard) && (hasMercadoPago || Boolean(creditCardLink));
  const canExternalLinkPayment = Boolean(externalLink) && !hasMercadoPago;

  // Quando abrir a área do crédito, descer automaticamente
  useEffect(() => {
    if (!showCreditInstructions) return;
    // aguardar render
    window.setTimeout(() => scrollToEl(creditSectionRef.current), 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCreditInstructions]);

  // Quando abrir a área do link externo, descer automaticamente
  useEffect(() => {
    if (!showExternalInstructions) return;
    window.setTimeout(() => scrollToEl(externalSectionRef.current), 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showExternalInstructions]);

  // Quando liberar botões (Paguei/Não consegui) no link externo, descer automaticamente
  useEffect(() => {
    if (!hasOpenedExternalLink) return;
    window.setTimeout(() => scrollToEl(externalActionsRef.current || externalSectionRef.current), 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasOpenedExternalLink]);

  // Quando liberar botões (Paguei/Não consegui), descer automaticamente
  useEffect(() => {
    if (!hasOpenedCreditLink) return;
    window.setTimeout(() => scrollToEl(creditActionsRef.current || creditSectionRef.current), 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasOpenedCreditLink]);

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
    provider:
      | 'pagarme_pix'
      | 'pagarme_card'
      | 'mercadopago_pix'
      | 'mercadopago_card'
      | 'mercadopago_card_recurring'
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

  const toastAfterSubscriptionConfirm = (successData: unknown) => {
    const op = String((successData as any)?.operation || '').toLowerCase();
    if (op === 'updated') {
      toast.success(
        'Renovação concluída! O mesmo cadastro em Meus Assinantes foi atualizado (novas datas e pagamento).'
      );
    } else {
      toast.success('Assinatura registrada! Você já aparece em Meus Assinantes do barbeiro.');
    }
  };

  const checkPaymentStatusOnce = async (
    orderId: string,
    provider:
      | 'pagarme_pix'
      | 'pagarme_card'
      | 'mercadopago_pix'
      | 'mercadopago_card'
      | 'mercadopago_card_recurring'
  ): Promise<{ normalized: string; reason?: string }> => {
    let status = '';
    let reason: string | undefined;

    if (provider === 'mercadopago_card_recurring') {
      const preapprovalUrl = import.meta.env.PROD
        ? '/.netlify/functions/mercadopago-get-preapproval-status'
        : '/api/mercadopago/get-preapproval-status';
      const r = await fetch(preapprovalUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          establishmentId,
          preapprovalId: orderId,
        }),
      });
      if (!r.ok) throw new Error('Erro ao verificar status da recorrência');
      const data = await r.json().catch(() => ({}));
      status = String(data?.preapproval?.status || '');
      reason = String(data?.preapproval?.reason || '').trim() || undefined;
    } else if (provider.startsWith('mercadopago_')) {
      const checkStatusUrl = import.meta.env.PROD
        ? `/.netlify/functions/mercadopago-check-status?paymentId=${orderId}&establishmentId=${establishmentId}`
        : `/api/mercadopago/check-status?paymentId=${orderId}&establishmentId=${establishmentId}`;
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
    provider:
      | 'pagarme_pix'
      | 'pagarme_card'
      | 'mercadopago_pix'
      | 'mercadopago_card'
      | 'mercadopago_card_recurring'
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

        const isConfirmedPayment =
          normalized === 'paid' ||
          normalized === 'approved' ||
          (normalized === 'authorized' && provider !== 'mercadopago_card_recurring');

        if (normalized === 'authorized' && provider === 'mercadopago_card_recurring') {
          if (statusIntervalRef.current) {
            window.clearInterval(statusIntervalRef.current);
            statusIntervalRef.current = null;
          }
          setIsCheckingPayment(false);
          toast.success('Recorrência ativa. A assinatura será liberada quando a cobrança for aprovada pelo Mercado Pago.');
          return;
        }

        if (isConfirmedPayment) {
          if (statusIntervalRef.current) {
            window.clearInterval(statusIntervalRef.current);
            statusIntervalRef.current = null;
          }
          setIsCheckingPayment(false);
          try {
            const successData = await confirmSubscription(orderId, provider);
            let recurringActivated = false;
            if (provider === 'mercadopago_card' && isMonthlySubscription) {
              try {
                const recurringResult = await createRecurringAfterApprovedCardPayment(orderId);
                recurringActivated = recurringResult.ok;
              } catch (recurringError: any) {
                console.error('❌ [MP recurring] falha pós-pagamento aprovado:', recurringError);
                toast.error(
                  `Pagamento aprovado, mas não foi possível ativar a renovação automática: ${String(recurringError?.message || 'erro desconhecido')}`
                );
              }
            }
            console.log('✅ Assinatura registrada com sucesso:', successData);
            toastAfterSubscriptionConfirm(successData);
            if (provider === 'mercadopago_card' && isMonthlySubscription && recurringActivated) {
              toast.success('Renovação automática ativada para a próxima cobrança mensal.');
            }
          } catch (e: any) {
            console.error('❌ Erro ao registrar assinatura:', e);
            // ✅ NÃO prender o usuário em pagamento avulso já aprovado.
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
          normalized === 'voided' ||
          normalized === 'paused'
        ) {
          if (statusIntervalRef.current) {
            window.clearInterval(statusIntervalRef.current);
            statusIntervalRef.current = null;
          }
          setIsCheckingPayment(false);
          const reasonStr = String(reason || '');

          // ✅ Qualquer recusa no cartão -> oferecer PIX sem refazer os dados
          if (provider === 'pagarme_card' || provider === 'mercadopago_card' || provider === 'mercadopago_card_recurring') {
            setCardRefusedReason(reasonStr || 'Pagamento no cartão recusado');
            if (reasonStr === 'cc_rejected_high_risk') {
              toast.error(
                'Pagamento recusado por segurança do Mercado Pago. Tente PIX ou pague com o cartão/dispositivo que você costuma usar.'
              );
            } else {
              toast.error('Pagamento no cartão recusado. Você pode pagar via PIX sem refazer seus dados.');
            }
            setSelectedMethod(null);
            return;
          }

          if (reasonStr === 'cc_rejected_high_risk') {
            toast.error(
              'Pagamento recusado por segurança do Mercado Pago. Recomendação: tente PIX ou pague com o meio/dispositivo que você costuma usar.'
            );
          } else {
            toast.error(reasonStr ? `Pagamento recusado/cancelado: ${reasonStr}` : 'Pagamento recusado ou cancelado');
          }
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

  const createRecurringAfterApprovedCardPayment = async (firstPaymentOrderId: string): Promise<{
    ok: boolean;
    requiresAction: boolean;
  }> => {
    if (!isMonthlySubscription) return { ok: false, requiresAction: false };
    setRecurringSetupUrl('');
    setRecurringSetupRequired(false);

    const setup = recurringSetupRef.current;
    if (!setup) {
      throw new Error('Pagamento aprovado, mas faltaram dados para ativar a renovação automática.');
    }

    const createSubscriptionUrl = import.meta.env.PROD
      ? '/.netlify/functions/mercadopago-create-subscription-checkout'
      : '/api/mercadopago/create-subscription-checkout';

    const requestBodyBase = {
      establishmentId,
      subscriptionId: subscription.id,
      payer: setup.payer,
      customer: setup.customer,
      card: setup.card,
      device_session_id: setup.deviceSessionId || undefined,
      first_payment_already_captured: true,
      first_payment_order_id: String(firstPaymentOrderId || '').trim(),
      backUrl: typeof window !== 'undefined' ? window.location.href : undefined,
    };

    const attemptCreateRecurring = async (withCardToken: boolean) => {
      const body = withCardToken && setup.token
        ? { ...requestBodyBase, card_token_id: setup.token }
        : requestBodyBase;

      const response = await fetch(createSubscriptionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const userMessage = String((result as any)?.userMessage || '').trim();
        throw new Error(
          userMessage || String((result as any)?.message || (result as any)?.error || `Erro ${response.status}`)
        );
      }

      return result as any;
    };

    let result: any;
    try {
      result = await attemptCreateRecurring(true);
    } catch (firstError: any) {
      // Se o token do cartão tiver expirado, tenta criar recorrência via checkout hospedado.
      result = await attemptCreateRecurring(false);
      console.warn('⚠️ [MP recurring] fallback para checkout hospedado:', firstError);
    }

    const preapprovalId = String(result?.preapproval_id || '').trim();
    const statusRaw = String(result?.subscription_status || result?.status || '').toLowerCase();
    const initPoint = String(result?.init_point || result?.sandbox_init_point || '').trim();

    if (!preapprovalId) {
      throw new Error('Mercado Pago não retornou ID da recorrência.');
    }

    setCurrentPaymentId(preapprovalId);
    setCurrentPaymentProvider('mercadopago_card_recurring');

    if (statusRaw === 'authorized' || statusRaw === 'approved' || statusRaw === 'paid') {
      setRecurringSetupUrl('');
      setRecurringSetupRequired(false);
      return { ok: true, requiresAction: false };
    }

    if (initPoint) {
      setRecurringSetupUrl(initPoint);
      setRecurringSetupRequired(true);
      toast.success(
        'Pagamento aprovado! Agora finalize o cadastro da recorrência automática no botão abaixo. Não se preocupe: você não vai pagar 2 vezes.'
      );
      return { ok: false, requiresAction: true };
    }

    return { ok: false, requiresAction: false };
  };

  const handleOpenRecurringSetup = () => {
    const url = String(recurringSetupUrl || '').trim();
    if (!url) {
      toast.error('Não foi possível encontrar o link para finalizar a recorrência automática.');
      return;
    }
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (!w) {
      // Se o navegador bloquear popup, segue na mesma aba por clique explícito do usuário.
      window.location.assign(url);
    }
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

      const cpfDigits = onlyDigits(cpf);
      if (cpfDigits.length === 11) {
        if (!isValidCPF(cpfDigits)) {
          toast.error('CPF inválido. Digite um CPF válido (11 dígitos).');
          return;
        }
      } else if (cpfDigits.length === 14) {
        if (!isValidCNPJ(cpfDigits)) {
          toast.error('CNPJ inválido. Digite um CNPJ válido (14 dígitos).');
          return;
        }
      } else {
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
        const feeExpectedCents = Number((result as any)?.application_fee_cents_expected ?? 100);
        const feeReturned = Number((result as any)?.application_fee ?? 0);
        const feeReturnedCents = Math.round(feeReturned * 100);
        const feeValidation = String((result as any)?.fee_validation || '').trim().toLowerCase();
        console.log('🧾 [MP Fee Audit] subscription create-payment:', {
          payment_id: (result as any)?.id || null,
          fee_expected_cents: feeExpectedCents,
          fee_returned: feeReturned,
          fee_returned_cents: feeReturnedCents,
          fee_validation: feeValidation || 'not_provided',
        });
        if (feeValidation === 'divergent' || feeReturnedCents !== feeExpectedCents) {
          console.warn('⚠️ [MP Fee Audit] Divergência detectada no create-payment da assinatura', {
            payment_id: (result as any)?.id || null,
            fee_expected_cents: feeExpectedCents,
            fee_returned_cents: feeReturnedCents,
            raw_fee_returned: feeReturned,
          });
        }
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
        // ✅ Pré-criar assinatura pendente (para aparecer no painel mesmo se o cliente fechar a tela)
        if (result?.id) {
          createPendingSubscription(String(result.id), 'mercadopago_pix');
        }
        checkPaymentStatusPeriodically(result.id, 'mercadopago_pix');
      } catch (err: any) {
        const isAbort = err?.name === 'AbortError';
        const rawMsg = String(err?.message || '').trim();
        const lower = rawMsg.toLowerCase();
        const isCpfInvalid =
          lower.includes('invalid user identification number') ||
          lower.includes('invalid identification number') ||
          lower.includes('identification number');
        const isPixNotEnabled =
          lower.includes('without key enabled') ||
          lower.includes('collector user') ||
          lower.includes('financial identity') ||
          lower.includes('qr render');

        toast.error(
          isAbort
            ? 'O servidor de pagamentos demorou demais para responder. Tente novamente.'
            : isCpfInvalid
              ? 'CPF inválido. Confira e digite um CPF válido (11 dígitos) para gerar o PIX.'
              : isPixNotEnabled
                ? 'PIX indisponível no Mercado Pago deste barbeiro. Ele precisa ativar/cadastrar uma chave PIX no app do Mercado Pago para gerar QR Code.'
                : `Erro ao gerar PIX: ${rawMsg || 'Erro desconhecido'}`
        );

        // Se o PIX falhar por configuração do recebedor, não deixar o usuário preso
        if (isPixNotEnabled) {
          setSelectedMethod(null);
        }
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
    if (cpfDigits.length !== 11 || !isValidCPF(cpfDigits)) {
      toast.error('CPF inválido. Digite um CPF válido (11 dígitos).');
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
      // ✅ Pré-criar assinatura pendente (para aparecer no painel mesmo se o cliente fechar a tela)
      if (result?.id) {
        createPendingSubscription(String(result.id), 'pagarme_pix');
      }
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

  /**
   * Cartão Mercado Pago na assinatura mensal:
   * cria preapproval (recorrência oficial) para cobrança automática mês a mês.
   */
  const handleMercadoPagoSubscriptionBrickSubmit = async (brickData: {
    token: string;
    payment_method_id: string;
    issuer_id: string;
    installments: number;
    bin?: string;
    lastFourDigits?: string;
  }) => {
    const customer = getCustomerForManualCredit();
    if (!customer) return;

    const cepDigits = onlyDigits(billingCep);
    const rua = String(billingRua || '').trim();
    const numero = String(billingNumero || '').replace(/\D/g, '');
    const cidade = String(billingCidade || '').trim();
    const uf = String(billingUf || '').trim().toUpperCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (cepDigits.length !== 8) {
      toast.error('CEP inválido. Informe 8 dígitos.');
      return;
    }
    if (!rua || !numero || !cidade || uf.length !== 2) {
      toast.error('Preencha rua, número, cidade e UF do endereço de cobrança.');
      return;
    }
    if (!customer.email || !emailRegex.test(customer.email)) {
      toast.error('Email inválido.');
      return;
    }

    const parts = String(nome || '').trim().split(/\s+/).filter(Boolean);
    const firstName = parts[0] || 'Cliente';
    const lastName = parts.slice(1).join(' ') || firstName;
    const mpDeviceSessionId =
      typeof window !== 'undefined'
        ? String((window as any)?.MP_DEVICE_SESSION_ID || '').trim()
        : '';

    setSelectedMethod('credit_card');
    setIsProcessing(true);
    setCardRefusedReason('');
    recurringSetupRef.current = {
      token: brickData.token,
      deviceSessionId: mpDeviceSessionId || undefined,
      payer: {
        email: customer.email,
        name: `${firstName} ${lastName}`.trim(),
        first_name: firstName,
        last_name: lastName,
        identification: {
          type: onlyDigits(cpf).length === 11 ? 'CPF' : 'CNPJ',
          number: onlyDigits(cpf),
        },
        phone: {
          area_code: customer.whatsapp.slice(0, 2),
          number: customer.whatsapp.slice(2),
        },
        address: {
          zip_code: cepDigits,
          street_name: rua,
          street_number: Number(numero) || 0,
          neighborhood: String(billingBairro || '').trim() || undefined,
          city: cidade,
          federal_unit: uf,
        },
      },
      customer: {
        name: nome.trim(),
        whatsapp,
        email: customer.email,
        document: onlyDigits(cpf),
      },
      card: {
        payment_method_id: brickData.payment_method_id,
        issuer_id: brickData.issuer_id,
        bin: brickData.bin,
        last_four_digits: brickData.lastFourDigits,
      },
    };

    try {
      const createPaymentUrl = import.meta.env.PROD
        ? '/.netlify/functions/mercadopago-create-payment'
        : '/api/mercadopago/create-payment';

      const paymentResponse = await fetch(createPaymentUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          establishmentId,
          amount: amountInCents,
          description: isMonthlySubscription
            ? `Assinatura ${subscription.name} (primeira cobrança do plano mensal)`
            : `Assinatura ${subscription.name} (pagamento por período)`,
          payment_method_id: brickData.payment_method_id,
          token: brickData.token,
          issuer_id: brickData.issuer_id,
          installments: brickData.installments,
          payer: {
            email: customer.email,
            identification: {
              type: onlyDigits(cpf).length === 11 ? 'CPF' : 'CNPJ',
              number: onlyDigits(cpf),
            },
            first_name: firstName,
            last_name: lastName,
            address: {
              zip_code: cepDigits,
              street_name: rua,
              street_number: Number(numero) || 0,
              neighborhood: String(billingBairro || '').trim() || '—',
              city: cidade,
              federal_unit: uf,
            },
          },
          metadata: {
            establishment_id: establishmentId,
            subscription_id: subscription.id,
            subscription_name: subscription.name,
            subscription_oneoff_card: true,
            subscription_monthly_first_charge: isMonthlySubscription,
          },
        }),
      });

      if (!paymentResponse.ok) {
        const paymentErrorData = await paymentResponse.json().catch(() => ({}));
        throw new Error(
          String(paymentErrorData.message || paymentErrorData.error || `Erro ${paymentResponse.status}`)
        );
      }

      const paymentResult = await paymentResponse.json();
      const pid = String((paymentResult as any)?.id || '').trim();
      const st = String((paymentResult as any)?.status || '').toLowerCase();
      const statusDetail = String((paymentResult as any)?.status_detail || '').trim();

      if (!pid) {
        throw new Error('Mercado Pago não retornou ID do pagamento.');
      }

      if (st === 'approved' || st === 'authorized') {
        setCurrentPaymentId(pid);
        setCurrentPaymentProvider('mercadopago_card');
        setHasOpenedCreditLink(true);
        const successData = await confirmSubscription(pid, 'mercadopago_card');
        let recurringActivated = false;
        if (isMonthlySubscription) {
          try {
            const recurringResult = await createRecurringAfterApprovedCardPayment(pid);
            recurringActivated = recurringResult.ok;
          } catch (recurringError: any) {
            console.error('❌ [MP recurring] falha ao ativar renovação automática:', recurringError);
            toast.error(
              `Pagamento aprovado, mas não foi possível ativar a renovação automática: ${String(recurringError?.message || 'erro desconhecido')}`
            );
          }
        }
        setIsPaid(true);
        setShowCreditInstructions(false);
        setHasOpenedCreditLink(false);
        setIsCheckingPayment(false);
        toastAfterSubscriptionConfirm(successData);
        if (isMonthlySubscription && recurringActivated) {
          toast.success('Renovação automática ativada para a próxima cobrança mensal.');
        }
        return;
      }

      if (
        st === 'rejected' ||
        st === 'refused' ||
        st === 'cancelled' ||
        st === 'canceled' ||
        st === 'failed' ||
        st === 'charged_back'
      ) {
        const reasonText = statusDetail || 'Pagamento no cartão recusado';
        setCurrentPaymentId('');
        setCurrentPaymentProvider('');
        setHasOpenedCreditLink(false);
        setIsCheckingPayment(false);
        setSelectedMethod(null);
        setCardRefusedReason(reasonText);
        if (reasonText.toLowerCase() === 'cc_rejected_high_risk') {
          toast.error(
            'Pagamento não aprovado: cc_rejected_high_risk. Tente outro cartão/dispositivo ou pague via PIX.'
          );
        } else {
          toast.error(`Pagamento não aprovado: ${reasonText}`);
        }
        return;
      }

      setCurrentPaymentId(pid);
      setCurrentPaymentProvider('mercadopago_card');
      setHasOpenedCreditLink(true);
      await createPendingSubscription(pid, 'mercadopago_card');
      setIsCheckingPayment(true);
      checkPaymentStatusPeriodically(pid, 'mercadopago_card');
    } catch (err: any) {
      toast.error(String(err?.message || 'Erro ao processar pagamento no cartão'));
    } finally {
      setIsProcessing(false);
    }
  };

  const createPendingSubscription = async (
    orderId: string,
    providerKey: 'pagarme_pix' | 'mercadopago_pix' | 'mercadopago_card' | 'mercadopago_card_recurring'
  ) => {
    const url = import.meta.env.PROD
      ? '/.netlify/functions/subscription-create-pending'
      : '/api/subscribers/create-pending-subscription';

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          establishmentId,
          subscriptionId: subscription.id,
          provider: providerKey,
          customer: {
            name: nome.trim(),
            whatsapp: whatsapp,
            email: email?.trim() || undefined,
            document: onlyDigits(cpf),
          },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) {
        const errorText = String(
          data?.error ||
          data?.message ||
          data?.details?.message ||
          `Erro ${response.status}`
        );
        throw new Error(errorText);
      }
      return data;
    } catch (e) {
      console.warn('⚠️ Falha ao pré-criar assinatura pendente:', e);
      throw new Error(
        `Recorrência criada no Mercado Pago, mas falhou ao criar o assinante como Não Pago no sistema: ${(e as any)?.message || 'erro desconhecido'}`
      );
    }
  };

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const getCustomerForManualCredit = () => {
    const customerName = String(nome || '').trim();
    const customerWhatsapp = String(whatsapp || '').replace(/\D/g, '');
    const docDigits = onlyDigits(cpf);
    const payerEmail = String(email || '').trim();

    if (!customerName) {
      toast.error('Informe seu nome.');
      return null;
    }
    if (customerWhatsapp.length < 10) {
      toast.error('Informe um WhatsApp válido (com DDD).');
      return null;
    }
    if (docDigits.length === 11) {
      if (!isValidCPF(docDigits)) {
        toast.error('CPF inválido. Digite um CPF válido (11 dígitos).');
        return null;
      }
    } else if (docDigits.length === 14) {
      if (!isValidCNPJ(docDigits)) {
        toast.error('CNPJ inválido. Digite um CNPJ válido (14 dígitos).');
        return null;
      }
    } else {
      toast.error('Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.');
      return null;
    }
    if (!payerEmail || !emailRegex.test(payerEmail)) {
      toast.error('Email inválido. Informe um email válido.');
      return null;
    }

    return {
      name: customerName,
      whatsapp: customerWhatsapp,
      email: payerEmail,
      document: docDigits,
    };
  };

  const handleOpenCreditPaymentLink = async (preOpenedPopup?: Window | null): Promise<boolean> => {
    const openTarget = (url: string) => {
      if (preOpenedPopup && !preOpenedPopup.closed) {
        preOpenedPopup.location.href = url;
        preOpenedPopup.focus();
        return true;
      }
      const newWin = window.open(url, '_blank', 'noopener,noreferrer');
      return Boolean(newWin);
    };

    try {
      // Mercado Pago: fluxo acontece no Brick (não usa link manual legado).
      if (hasMercadoPago) {
        toast.error('Use o formulário de cartão abaixo.');
        return false;
      }

      const customer = getCustomerForManualCredit();
      if (!customer) return false;

      const link = String(creditCardLink || '').trim();
      if (!link) {
        toast.error(
          'O dono do estabelecimento não utiliza pagamento no cartão de crédito. Por favor, realize o pagamento via Pix.'
        );
        return false;
      }

      setHasOpenedCreditLink(true);
      const opened = openTarget(link);
      if (!opened) {
        toast.error('O navegador bloqueou a nova aba. Permita pop-ups para continuar no cartão.');
        return false;
      }
      return true;
    } catch (error: any) {
      if (preOpenedPopup && !preOpenedPopup.closed) {
        preOpenedPopup.close();
      }
      toast.error(String(error?.message || 'Erro ao abrir checkout de cartão'));
      return false;
    }
  };

  const handleCreditNotSucceeded = () => {
    toast.error('Não deu certo no cartão. Você pode tentar de novo ou pagar com PIX.');
    setShowCreditInstructions(false);
    setHasOpenedCreditLink(false);
    setCurrentPaymentId('');
    setCurrentPaymentProvider('');
    setIsCheckingPayment(false);
  };

  const handleCreditPaid = async () => {
    const customer = getCustomerForManualCredit();
    if (!customer) return;

    if (hasMercadoPago) {
      const pid = String(currentPaymentId || '').trim();
      if (!pid) {
        toast.error('Nenhuma assinatura/pagamento em andamento. Preencha o cartão acima primeiro.');
        return;
      }
      setIsProcessing(true);
      try {
        const mpProvider =
          currentPaymentProvider === 'mercadopago_card_recurring'
            ? 'mercadopago_card_recurring'
            : 'mercadopago_card';
        const { normalized, reason } = await checkPaymentStatusOnce(pid, mpProvider);
        const isConfirmedPayment =
          normalized === 'paid' ||
          normalized === 'approved' ||
          (normalized === 'authorized' && mpProvider !== 'mercadopago_card_recurring');

        if (isConfirmedPayment) {
          const successData = await confirmSubscription(pid, mpProvider);
          let recurringActivated = false;
          if (mpProvider === 'mercadopago_card' && isMonthlySubscription) {
            try {
              const recurringResult = await createRecurringAfterApprovedCardPayment(pid);
              recurringActivated = recurringResult.ok;
            } catch (recurringError: any) {
              toast.error(
                `Pagamento aprovado, mas não foi possível ativar a renovação automática: ${String(recurringError?.message || 'erro desconhecido')}`
              );
            }
          }
          setIsPaid(true);
          setCurrentPaymentProvider(mpProvider);
          setShowCreditInstructions(false);
          setHasOpenedCreditLink(false);
          setIsCheckingPayment(false);
          toastAfterSubscriptionConfirm(successData);
          if (mpProvider === 'mercadopago_card' && isMonthlySubscription && recurringActivated) {
            toast.success('Renovação automática ativada para a próxima cobrança mensal.');
          }
          return;
        }
        if (normalized === 'authorized' && mpProvider === 'mercadopago_card_recurring') {
          toast.success('Recorrência ativa. A assinatura será liberada quando a cobrança aparecer aprovada no Mercado Pago.');
          return;
        }
        if (
          normalized === 'refused' ||
          normalized === 'rejected' ||
          normalized === 'cancelled' ||
          normalized === 'canceled'
        ) {
          toast.error(
            reason
              ? `Pagamento não aprovado: ${reason}`
              : 'Pagamento não aprovado no Mercado Pago.'
          );
          return;
        }
        toast.error('Pagamento ainda pendente. Aguarde alguns segundos e tente de novo.');
      } catch (e: any) {
        toast.error(String(e?.message || 'Erro ao verificar pagamento no Mercado Pago'));
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    const claimUrl = import.meta.env.PROD
      ? '/.netlify/functions/subscription-claim-credit'
      : '/api/subscribers/claim-subscription-credit';

    setIsProcessing(true);
    try {
      const resp = await fetch(claimUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          establishmentId,
          subscriptionId: subscription.id,
          customer,
          providerKey: 'credit_link',
          paymentLink: String(creditCardLink || '').trim() || undefined,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        const msg = String(err?.error || err?.message || `Erro ${resp.status}`);
        throw new Error(msg);
      }

      toast.success('Assinatura registrada! Agora confirme com o barbeiro no WhatsApp.');
      // Trocar a UI para "concluído" (pendente), evitando voltar para o formulário ao retornar do WhatsApp.
      setIsCreditClaimed(true);

      const phone = String(establishmentWhatsapp || '').replace(/\D/g, '');
      if (phone) {
        const phoneWithCountry = phone.startsWith('55') ? phone : `55${phone}`;
        const message = `Comprei a assinatura (${subscription.name}) no cartão de crédito.\n\nConsegue confirmar para mim se o pagamento foi realizado no seu sistema para que eu possa começar a usar?`;
        window.open(`https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`, '_blank');
      } else {
        toast.error('WhatsApp do estabelecimento não configurado.');
      }

      // Encerrar área de crédito (a tela de "concluído" fica ativa)
      setShowCreditInstructions(false);
      setHasOpenedCreditLink(false);
    } catch (e: any) {
      toast.error(String(e?.message || 'Erro ao registrar assinatura no cartão'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenExternalPaymentLink = () => {
    const customer = getCustomerForManualCredit();
    if (!customer) return;
    if (!externalLink) {
      toast.error('Link de pagamento não configurado para esta assinatura.');
      return;
    }
    setHasOpenedExternalLink(true);
    window.open(externalLink, '_blank', 'noopener,noreferrer');
  };

  const handleExternalNotSucceeded = () => {
    toast.error('Não deu certo no link. Você pode tentar novamente.');
    setShowExternalInstructions(false);
    setHasOpenedExternalLink(false);
  };

  const handleExternalPaid = async () => {
    const customer = getCustomerForManualCredit();
    if (!customer) return;
    if (!externalLink) {
      toast.error('Link de pagamento não configurado.');
      return;
    }

    const claimUrl = import.meta.env.PROD
      ? '/.netlify/functions/subscription-claim-credit'
      : '/api/subscribers/claim-subscription-credit';

    setIsProcessing(true);
    try {
      const resp = await fetch(claimUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          establishmentId,
          subscriptionId: subscription.id,
          customer,
          providerKey: 'custom_link',
          paymentLink: externalLink,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        const msg = String(err?.error || err?.message || `Erro ${resp.status}`);
        throw new Error(msg);
      }

      toast.success('Solicitação enviada! Agora confirme com o barbeiro.');
      setIsExternalClaimed(true);

      const phone = String(establishmentWhatsapp || '').replace(/\D/g, '');
      if (phone) {
        const phoneWithCountry = phone.startsWith('55') ? phone : `55${phone}`;
        const message = `Comprei a assinatura (${subscription.name}) pelo link de pagamento.\n\nConsegue confirmar pra mim se deu tudo certo para liberar meu uso?`;
        window.open(`https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`, '_blank');
      }

      setShowExternalInstructions(false);
      setHasOpenedExternalLink(false);
    } catch (e: any) {
      toast.error(String(e?.message || 'Erro ao registrar assinatura pelo link'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreditConfirmYes = async () => {
    setShowCreditConfirm(false);
    setShowCreditInstructions(true);
    setHasOpenedCreditLink(false);

    // Mercado Pago: assinatura recorrente mensal (ou avulso para planos não mensais) via Brick.
    if (hasMercadoPago) {
      return;
    }

    const popup = window.open('', '_blank');
    if (!popup) {
      toast.error('Seu navegador bloqueou pop-up. Libere pop-ups para o agendeifacil.com.');
      setShowCreditInstructions(false);
      return;
    }

    const opened = await handleOpenCreditPaymentLink(popup);
    if (!opened) {
      if (!popup.closed) popup.close();
      setShowCreditInstructions(false);
    }
  };

  const handleCreditConfirmNo = () => {
    setShowCreditConfirm(false);
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

  // ✅ Abrir fluxo inicial (sem abrir WhatsApp direto no Booking)
  useEffect(() => {
    if (!isOpen) return;
    if (initialFlow === 'credit' && canCard) {
      setShowCreditConfirm(true);
    } else if (initialFlow === 'whatsapp') {
      // Não é PIX nem link; o usuário vai preencher os dados e clicar em "Enviar pedido no WhatsApp"
      setSelectedMethod(null);
      setShowCreditConfirm(false);
      setShowCreditInstructions(false);
      setShowExternalInstructions(false);
    }
  }, [canCard, isOpen, initialFlow]);

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
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[80] p-4 overflow-y-auto"
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
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto px-6 pb-6"
          style={{ minHeight: 0, WebkitOverflowScrolling: 'touch' }}
        >
          <div className="bg-[#111213] border border-gray-700 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-200">
              Plano: <span className="font-semibold">{subscription.name}</span>
            </p>
            <p className="text-sm text-gray-200 mt-1">
              Valor: <span className="font-semibold">R$ {Number(subscription.value || 0).toFixed(2).replace('.', ',')}</span>
            </p>
            <p className="text-xs text-gray-400 mt-2">
              {hasMercadoPago && allowedCard && isMonthlySubscription
                ? 'No cartão, este plano mensal vira assinatura recorrente automática pelo Mercado Pago.'
                : 'O plano vale por um período. Quando vencer, você renova conforme a forma de pagamento escolhida.'}
            </p>
            {hasMercadoPago && allowedCard ? (
              <p className="text-xs text-amber-100/95 mt-2 rounded border border-amber-600/40 bg-amber-500/10 p-2">
                <span className="font-semibold">Cartão (Mercado Pago):</span>{' '}
                {isMonthlySubscription
                  ? 'assinatura recorrente automática no cartão (cobrança mensal pelo Mercado Pago).'
                  : 'para planos não mensais, o pagamento no cartão continua avulso por período.'}
              </p>
            ) : null}
          </div>

          {(isPaid || isCreditClaimed || isExternalClaimed) ? (
            <div className="space-y-4">
              <div className="bg-green-600/15 border border-green-500/40 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-green-300 mt-0.5" />
                  <div>
                    <p className="text-green-200 font-extrabold text-base">
                      {(isCreditClaimed || isExternalClaimed)
                        ? 'Solicitação enviada ✅'
                        : recurringSetupRequired
                          ? 'Parabéns! Você assinou no cartão ✅'
                          : 'Parabéns! Você assinou ✅'}
                    </p>
                    <p className="text-sm text-gray-200 mt-1">
                      Plano: <span className="font-semibold">{subscription.name}</span> da barbearia{' '}
                      <span className="font-semibold">{establishmentName}</span>.
                    </p>
                    <p className="text-sm text-gray-300 mt-2">
                      {(isCreditClaimed || isExternalClaimed)
                        ? 'Pagamento externo. Agora peça para o barbeiro confirmar no sistema para liberar seu uso.'
                        : recurringSetupRequired
                          ? 'Sua cobrança de hoje já foi aprovada. Agora finalize o cadastro da recorrência automática para as próximas mensalidades. Fique tranquilo: isso não cobra 2 vezes, é apenas para o sistema cobrar nos próximos meses. Você não será cobrado novamente agora.'
                          : 'Agora avise seu barbeiro e pronto.'}
                    </p>
                  </div>
                </div>
              </div>

              {recurringSetupRequired ? (
                <button
                  type="button"
                  onClick={handleOpenRecurringSetup}
                  className="w-full px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-extrabold transition-colors"
                >
                  Finalizar cadastro da recorrência automática
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => {
                  const phone = String(establishmentWhatsapp || '').replace(/\D/g, '');
                  if (!phone) {
                    toast.error('WhatsApp do estabelecimento não configurado.');
                    return;
                  }
                  const phoneWithCountry = phone.startsWith('55') ? phone : `55${phone}`;
                  const message = isCreditClaimed
                    ? `Comprei a assinatura (${subscription.name}) no cartão de crédito.\n\nConsegue confirmar para mim se o pagamento foi realizado no seu sistema para que eu possa começar a usar?`
                    : isExternalClaimed
                      ? `Comprei a assinatura (${subscription.name}) pelo link de pagamento.\n\nConsegue confirmar para mim se deu tudo certo para eu começar a usar?`
                      : `Parabéns! Acabei de assinar o plano "${subscription.name}" da barbearia ${establishmentName}. ✅\n\nMeu nome: ${nome || ''}\nMeu WhatsApp: ${whatsapp || ''}\n\nPode confirmar pra mim?`;
                  window.open(`https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`, '_blank');
                }}
                className="w-full px-4 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-extrabold transition-colors flex items-center justify-center gap-2"
              >
                <MessageCircle className="h-5 w-5" />
                {(isCreditClaimed || isExternalClaimed) ? 'Abrir WhatsApp novamente' : 'Avisar meu barbeiro no WhatsApp'}
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
                  onChange={(e) => {
                    // ✅ aceitar só números e limitar tamanho (DDD + número)
                    let digits = onlyDigits(e.target.value || '');
                    // Se colar com código do país (55...), remover para manter padrão de 10-11 dígitos
                    if (digits.startsWith('55') && digits.length > 11) {
                      digits = digits.slice(2);
                    }
                    setWhatsapp(digits.slice(0, 11));
                  }}
                  className="w-full px-3 py-2 rounded-md bg-[#111213] border border-gray-700 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="99 9 9999-9999"
                  inputMode="tel"
                  maxLength={11}
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
                <label className="block text-sm text-gray-300 mb-1">
                  Email {paymentProvider === 'mercadopago' ? '(obrigatório)' : '(opcional)'}
                </label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-[#111213] border border-gray-700 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="email@exemplo.com"
                  inputMode="email"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                {/* Se tiver link externo (custom_link) e NÃO estiver usando Mercado Pago, mostrar o fluxo do link
                    mesmo quando PIX/cartão interno estiver desativado. */}
                {canExternalLinkPayment ? (
                  <button
                    type="button"
                    onClick={() => setShowExternalInstructions(true)}
                    disabled={isProcessing}
                    className="w-full px-4 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    Efetuar pagamento
                  </button>
                ) : canPix ? (
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
                ) : !canCard ? (
                  <button
                    type="button"
                    onClick={() => {
                      const phone = String(establishmentWhatsapp || '').replace(/\D/g, '');
                      if (!phone) {
                        toast.error('WhatsApp do estabelecimento não configurado.');
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
                      const phoneWithCountry = phone.startsWith('55') ? phone : `55${phone}`;
                      const msg = `Quero assinar o plano "${subscription.name}" da barbearia ${establishmentName}.\n\nMeu nome: ${nome}\nMeu WhatsApp: ${whatsapp}\nMeu CPF: ${cpf || ''}\nMeu email: ${email || ''}\n\nPode me passar a forma de pagamento e confirmar pra mim depois?`;
                      window.open(`https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(msg)}`, '_blank');
                    }}
                    disabled={isProcessing || isCheckingPayment}
                    className="w-full px-4 py-3 rounded-lg bg-[#2a2b2c] hover:bg-[#343536] text-white font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-gray-700"
                  >
                    <MessageCircle className="h-5 w-5" />
                    Enviar pedido no WhatsApp
                  </button>
                ) : null}

                {/* Cartão: Mercado Pago externo ou link manual legado */}
                {canCard && hasMercadoPago ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreditConfirm(true);
                    }}
                    disabled={isProcessing || isCheckingPayment}
                    className="w-full px-4 py-3 rounded-lg bg-[#2a2b2c] hover:bg-[#343536] text-white font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-gray-700"
                  >
                    <CreditCard className="h-5 w-5" />
                    Cartão de crédito
                  </button>
                ) : canCard && creditCardLink ? (
                  <button
                    type="button"
                    onClick={() => setShowCreditConfirm(true)}
                    disabled={isProcessing || isCheckingPayment}
                    className="w-full px-4 py-3 rounded-lg bg-[#2a2b2c] hover:bg-[#343536] text-white font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-gray-700"
                  >
                    <CreditCard className="h-5 w-5" />
                    Cartão de crédito
                  </button>
                ) : null}
              </div>

              {!canPix && !canCard && !canExternalLinkPayment && (
                <div className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3">
                  <p className="text-sm text-rose-100 font-semibold">
                    Esta assinatura está sem forma de pagamento ativa no momento.
                  </p>
                  <p className="text-xs text-rose-200/90 mt-1">
                    Chame o estabelecimento para habilitar PIX ou Cartão nesta assinatura.
                  </p>
                </div>
              )}

              {showExternalInstructions && canExternalLinkPayment ? (
                <div ref={externalSectionRef} className="mt-4 space-y-3 border-t border-gray-800 pt-4">
                  <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4">
                    <p className="text-sm text-yellow-200 font-extrabold">
                      Após pagar no link, volte aqui para concluir.
                    </p>
                    <p className="text-xs text-yellow-200/90 mt-2">
                      Clique em <span className="font-semibold">“Paguei”</span> depois de finalizar o pagamento no site.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleOpenExternalPaymentLink}
                    disabled={isProcessing}
                    className="w-full px-4 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-extrabold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    Pagar assinatura agora
                  </button>

                  {hasOpenedExternalLink && (
                    <div ref={externalActionsRef} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handleExternalPaid}
                        disabled={isProcessing}
                        className="w-full px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-extrabold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        Paguei
                      </button>
                      <button
                        type="button"
                        onClick={handleExternalNotSucceeded}
                        disabled={isProcessing}
                        className="w-full px-4 py-3 rounded-lg bg-[#2a2b2c] hover:bg-[#343536] text-white font-extrabold transition-colors disabled:opacity-60 disabled:cursor-not-allowed border border-gray-700"
                      >
                        Não consegui
                      </button>
                    </div>
                  )}
                </div>
              ) : null}

              {showCreditInstructions ? (
                <div ref={creditSectionRef} className="mt-4 space-y-3 border-t border-gray-800 pt-4">
                  {hasMercadoPago ? (
                    <>
                      <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-4">
                        <p className="text-sm text-amber-100 font-extrabold">
                          {isMonthlySubscription
                            ? 'Cartão — assinatura recorrente mensal (Mercado Pago)'
                            : 'Cartão — pagamento avulso por período (Mercado Pago)'}
                        </p>
                        <p className="text-xs text-amber-100/90 mt-2">
                          {isMonthlySubscription
                            ? 'Preencha o endereço de cobrança e os dados do cartão para criar a recorrência oficial do Mercado Pago. A cobrança mensal passa a ser automática.'
                            : 'Preencha o endereço de cobrança e os dados do cartão abaixo. Este plano não mensal usa pagamento avulso por período.'}
                        </p>
                      </div>

                      {!(
                        currentPaymentId &&
                          (currentPaymentProvider === 'mercadopago_card' || currentPaymentProvider === 'mercadopago_card_recurring') &&
                        isCheckingPayment
                      ) ? (
                        <div className="space-y-2 rounded-lg border border-gray-700 bg-[#111213] p-3">
                          <p className="text-xs font-semibold text-gray-300">Endereço de cobrança (obrigatório)</p>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              value={billingCep}
                              onChange={(e) => setBillingCep(onlyDigits(e.target.value).slice(0, 8))}
                              className="px-2 py-1.5 rounded bg-[#1a1b1c] border border-gray-600 text-white text-sm"
                              placeholder="CEP"
                              inputMode="numeric"
                            />
                            <input
                              value={billingUf}
                              onChange={(e) => setBillingUf(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2))}
                              className="px-2 py-1.5 rounded bg-[#1a1b1c] border border-gray-600 text-white text-sm"
                              placeholder="UF"
                            />
                          </div>
                          <input
                            value={billingRua}
                            onChange={(e) => setBillingRua(e.target.value)}
                            className="w-full px-2 py-1.5 rounded bg-[#1a1b1c] border border-gray-600 text-white text-sm"
                            placeholder="Rua"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              value={billingNumero}
                              onChange={(e) => setBillingNumero(e.target.value)}
                              className="px-2 py-1.5 rounded bg-[#1a1b1c] border border-gray-600 text-white text-sm"
                              placeholder="Número"
                            />
                            <input
                              value={billingBairro}
                              onChange={(e) => setBillingBairro(e.target.value)}
                              className="px-2 py-1.5 rounded bg-[#1a1b1c] border border-gray-600 text-white text-sm"
                              placeholder="Bairro"
                            />
                          </div>
                          <input
                            value={billingCidade}
                            onChange={(e) => setBillingCidade(e.target.value)}
                            className="w-full px-2 py-1.5 rounded bg-[#1a1b1c] border border-gray-600 text-white text-sm"
                            placeholder="Cidade"
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 py-4 text-blue-200">
                          <Loader2 className="h-8 w-8 animate-spin" />
                          <p className="text-sm">Confirmando pagamento no cartão...</p>
                        </div>
                      )}

                      {String(import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY || '').trim() ? (
                        !(currentPaymentId &&
                          (currentPaymentProvider === 'mercadopago_card' || currentPaymentProvider === 'mercadopago_card_recurring') &&
                          isCheckingPayment) ? (
                          <div className="rounded-lg border border-gray-700 bg-[#111213] p-2">
                            <CardPaymentBrick
                              publicKey={String(import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY || '').trim()}
                              amount={Number(subscription.value || 0)}
                              payerData={{
                                email: String(email || '').trim(),
                                identificationType: onlyDigits(cpf).length === 14 ? 'CNPJ' : 'CPF',
                                identificationNumber: onlyDigits(cpf),
                                firstName: String(nome || '').trim().split(/\s+/)[0] || 'Cliente',
                                lastName:
                                  String(nome || '')
                                    .trim()
                                    .split(/\s+/)
                                    .slice(1)
                                    .join(' ') || 'Cliente',
                              }}
                              onSubmit={handleMercadoPagoSubscriptionBrickSubmit}
                              onError={(err: any) => {
                                const msg = String(err?.message || '').trim();
                                if (msg.toLowerCase().includes('secure fields')) {
                                  toast.error(
                                    'Cartão indisponível no momento. Tente PIX ou desative bloqueador de anúncios.'
                                  );
                                } else if (msg) {
                                  toast.error(msg);
                                }
                              }}
                            />
                          </div>
                        ) : null
                      ) : (
                        <p className="text-sm text-red-300">
                          Configure VITE_MERCADOPAGO_PUBLIC_KEY para pagar no cartão aqui.
                        </p>
                      )}

                      {(hasOpenedCreditLink || Boolean(String(currentPaymentId || '').trim())) &&
                      (currentPaymentProvider === 'mercadopago_card' || currentPaymentProvider === 'mercadopago_card_recurring') ? (
                        <div ref={creditActionsRef} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={handleCreditPaid}
                            disabled={isProcessing}
                            className="w-full px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-extrabold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            Paguei / Verificar
                          </button>
                          <button
                            type="button"
                            onClick={handleCreditNotSucceeded}
                            disabled={isProcessing}
                            className="w-full px-4 py-3 rounded-lg bg-[#2a2b2c] hover:bg-[#343536] text-white font-extrabold transition-colors disabled:opacity-60 disabled:cursor-not-allowed border border-gray-700"
                          >
                            Não consegui
                          </button>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4">
                        <p className="text-sm text-yellow-200 font-extrabold">
                          Após pagar, volte nesta página para concluir e ativar.
                        </p>
                        <p className="text-xs text-yellow-200/90 mt-2">
                          Atenção: se você pagar e não voltar aqui para clicar em{' '}
                          <span className="font-semibold">“Paguei”</span>, mesmo que esteja pago, o sistema pode não
                          concluir sua conta automaticamente.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenCreditPaymentLink()}
                        disabled={isProcessing}
                        className="w-full px-4 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-extrabold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        Pagar agora
                      </button>

                      {hasOpenedCreditLink && (
                        <div ref={creditActionsRef} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={handleCreditPaid}
                            disabled={isProcessing}
                            className="w-full px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-extrabold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            Paguei
                          </button>
                          <button
                            type="button"
                            onClick={handleCreditNotSucceeded}
                            disabled={isProcessing}
                            className="w-full px-4 py-3 rounded-lg bg-[#2a2b2c] hover:bg-[#343536] text-white font-extrabold transition-colors disabled:opacity-60 disabled:cursor-not-allowed border border-gray-700"
                          >
                            Não consegui
                          </button>
                        </div>
                      )}
                    </>
                  )}
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
                              const successData = await confirmSubscription(id, provider);
                              toastAfterSubscriptionConfirm(successData);
                            } catch (e: any) {
                              toast.error(`Pagamento confirmado, mas falhou registrar: ${e?.message || 'erro'}`);
                            }
                            setIsPaid(true);
                            setIsCheckingPayment(false);
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

        {/* Modal: confirmação do pagamento no crédito */}
        {showCreditConfirm && (
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) handleCreditConfirmNo();
            }}
          >
            <div className="w-full max-w-sm rounded-xl bg-[#1a1b1c] border border-gray-700 p-5 shadow-2xl">
              <p className="text-white font-extrabold text-lg">Deseja pagar no crédito?</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleCreditConfirmYes}
                  className="px-4 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-extrabold transition-colors"
                >
                  Sim
                </button>
                <button
                  type="button"
                  onClick={handleCreditConfirmNo}
                  className="px-4 py-3 rounded-lg bg-[#2a2b2c] hover:bg-[#343536] text-white font-extrabold transition-colors border border-gray-700"
                >
                  Não
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


