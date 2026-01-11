import { Loader2, QrCode, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

type SubscriptionPixModalProps = {
  isOpen: boolean;
  onClose: () => void;
  establishmentId: string;
  recipientId: string;
  subscription: {
    id: string;
    name: string;
    value: number; // em reais (como vem do banco)
    duration_months?: number | null;
  };
};

export const SubscriptionPixModal: React.FC<SubscriptionPixModalProps> = ({
  isOpen,
  onClose,
  establishmentId,
  recipientId,
  subscription,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [pixQrCode, setPixQrCode] = useState('');
  const [pixQrCodeUrl, setPixQrCodeUrl] = useState('');
  const [cpf, setCpf] = useState('');
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const countdownRef = useRef<number | null>(null);
  const [expiresInSeconds, setExpiresInSeconds] = useState(90);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const amountInCents = Math.round(Number(subscription.value || 0) * 100);

  useEffect(() => {
    if (!isOpen) return;
    // reset básico ao abrir
    setIsProcessing(false);
    setIsCheckingPayment(false);
    setPixQrCode('');
    setPixQrCodeUrl('');
    setExpiresInSeconds(90);
    setRemainingSeconds(0);
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

  const checkPaymentStatusPeriodically = async (orderId: string) => {
    const maxAttempts = 60;
    let attempts = 0;
    const interval = window.setInterval(async () => {
      attempts++;
      try {
        const checkStatusUrl = import.meta.env.PROD
          ? `/.netlify/functions/pagarme-check-status?orderId=${orderId}`
          : `/api/pagarme/check-status?orderId=${orderId}`;

        const r = await fetch(checkStatusUrl);
        if (!r.ok) throw new Error('Erro ao verificar status');
        const { status } = await r.json();
        const normalized = String(status || '').toLowerCase();

        if (normalized === 'paid' || normalized === 'authorized') {
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

          toast.success('Pagamento confirmado! Você já aparece em "Meus Assinantes".');
          onClose();
        } else if (
          normalized === 'refused' ||
          normalized === 'pending_refund' ||
          normalized === 'failed' ||
          normalized === 'canceled' ||
          normalized === 'cancelled' ||
          normalized === 'voided'
        ) {
          window.clearInterval(interval);
          setIsCheckingPayment(false);
          toast.error('Pagamento recusado ou cancelado');
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

    setIsProcessing(true);
    setPixQrCode('');
    setPixQrCodeUrl('');

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
      checkPaymentStatusPeriodically(result.id);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1b1c] rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-800 text-white">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Assinatura via PIX
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
            Sem cobrança automática. Seu cliente só será lembrado para manter em dia.
          </p>
        </div>

        {!pixQrCode ? (
          <div className="space-y-3">
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

            <button
              onClick={handleGeneratePix}
              disabled={isProcessing}
              className="w-full mt-2 px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Gerando PIX...
                </>
              ) : (
                'Gerar PIX'
              )}
            </button>
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


