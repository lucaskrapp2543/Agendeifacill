import { CheckCircle2, CreditCard, Loader2, MessageCircle, QrCode, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { criarTokenCartaoPagarme } from '../lib/pagarmeTokenize';
import { tokenizeMercadoPagoCard } from '../lib/mercadopago/tokenize-card';

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
  const [expiresInSeconds, setExpiresInSeconds] = useState(90);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const amountInCents = Math.round(Number(subscription.value || 0) * 100);

  useEffect(() => {
    if (!isOpen) return;
    // reset básico ao abrir
    setSelectedMethod(null);
    setIsProcessing(false);
    setIsCheckingPayment(false);
    setPixQrCode('');
    setPixQrCodeUrl('');
    setIsPaid(false);
    setExpiresInSeconds(90);
    setRemainingSeconds(0);
    setCardRefusedReason('');
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

  const formatMMSS = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const checkPaymentStatusPeriodically = async (orderId: string, provider: 'pagarme_pix' | 'pagarme_card' | 'mercadopago_pix' | 'mercadopago_card') => {
    const maxAttempts = 60;
    let attempts = 0;
    const interval = window.setInterval(async () => {
      attempts++;
      try {
        let status: string;
        let reason: string | undefined;
        
        if (provider.startsWith('mercadopago_')) {
          // Verificar status Mercado Pago
          const checkStatusUrl = import.meta.env.PROD
            ? `/.netlify/functions/mercadopago-check-status?paymentId=${orderId}`
            : `/api/mercadopago/check-status?paymentId=${orderId}`;

          const r = await fetch(checkStatusUrl);
          if (!r.ok) throw new Error('Erro ao verificar status');
          const data = await r.json();
          status = data.status || '';
          reason = data.status_detail || undefined;
        } else {
          // Verificar status Pagar.me
          const checkStatusUrl = import.meta.env.PROD
            ? `/.netlify/functions/pagarme-check-status?orderId=${orderId}`
            : `/api/pagarme/check-status?orderId=${orderId}`;

          const r = await fetch(checkStatusUrl);
          if (!r.ok) throw new Error('Erro ao verificar status');
          const result = await r.json();
          status = result.status || '';
          reason = result.reason || undefined;
        }

        const normalized = String(status || '').toLowerCase();

        if (normalized === 'paid' || normalized === 'authorized' || normalized === 'approved') {
          window.clearInterval(interval);
          setIsCheckingPayment(false);
          try {
            const confirmUrl = import.meta.env.PROD
              ? '/.netlify/functions/subscription-confirm-pix'
              : '/api/subscribers/confirm-subscription-pix';

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
          } catch (e: any) {
            toast.error(`Pagamento confirmado, mas não consegui registrar como assinante: ${e?.message || 'erro'}`);
            return;
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
          window.clearInterval(interval);
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
          window.clearInterval(interval);
          setIsCheckingPayment(false);
          toast.error('Tempo limite de pagamento excedido');
        }
      } catch {
        if (attempts >= maxAttempts) {
          window.clearInterval(interval);
          setIsCheckingPayment(false);
        }
      }
    }, 5000);
  };

  const handleGeneratePix = async () => {
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
              email: email?.trim() || 'cliente@exemplo.com',
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
    if (!String(recipientId || '').trim()) {
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

  const handlePayWithCard = async () => {
    if (!String(recipientId || '').trim()) {
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1b1c] rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-800 text-white">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Assinatura
          </h2>
          {!isProcessing && (
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <X className="h-5 w-5 text-gray-300" />
            </button>
          )}
        </div>

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
                    // Se já tiver dados preenchidos, processar imediatamente
                    if (nome.trim() && cpf && whatsapp) {
                      handlePayWithCard();
                    }
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
                <div className="bg-green-600/10 border border-green-500/30 rounded-lg p-3">
                  <p className="text-sm text-green-200">
                    Cartão usa tokenização segura ({paymentProvider === 'mercadopago' ? 'Mercado Pago' : 'Pagar.me'}). O número do cartão não vai para o servidor.
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

                <button
                  onClick={handlePayWithCard}
                  disabled={isProcessing || isCheckingPayment}
                  className="w-full px-4 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-extrabold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

            {isCheckingPayment && (
              <div className="flex items-center justify-center gap-2 text-blue-300">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Aguardando confirmação do pagamento...</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};


