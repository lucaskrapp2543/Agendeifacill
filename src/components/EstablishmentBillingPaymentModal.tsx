import { Copy, CreditCard, Loader2, QrCode, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type BillingMethod = 'pix' | 'credit_card' | null;

interface EstablishmentBillingPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  establishmentId: string;
  establishmentName: string;
  onPaid?: () => Promise<void> | void;
}

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export const EstablishmentBillingPaymentModal: React.FC<EstablishmentBillingPaymentModalProps> = ({
  isOpen,
  onClose,
  establishmentId,
  establishmentName,
  onPaid,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<BillingMethod>('pix');
  const [billingAmount, setBillingAmount] = useState<number>(0);
  const [isLoadingAmount, setIsLoadingAmount] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const [pixCode, setPixCode] = useState('');
  const [pixQrBase64, setPixQrBase64] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [configError, setConfigError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setSelectedMethod('pix');
    setPixCode('');
    setPixQrBase64('');
    setPaymentId('');
    setStatusMessage('');
    setConfigError('');
    setBillingAmount(0);
    setIsLoadingAmount(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !paymentId) return;

    const interval = window.setInterval(async () => {
      setIsRefreshingStatus(true);
      try {
        const { data, error } = await (supabase as any)
          .from('establishment_billing_payments')
          .select('status, paid_at')
          .eq('payment_id', paymentId)
          .eq('establishment_id', establishmentId)
          .maybeSingle();

        if (error) throw error;

        const normalizedStatus = String((data as any)?.status || '').toLowerCase().trim();
        if (normalizedStatus === 'paid') {
          setStatusMessage('Pagamento confirmado! Seu sistema foi regularizado automaticamente.');
          if (onPaid) await onPaid();
          window.clearInterval(interval);
          return;
        }

        if (normalizedStatus === 'failed' || normalizedStatus === 'cancelled' || normalizedStatus === 'refunded') {
          setStatusMessage('O pagamento foi recusado/cancelado. Gere um novo PIX para regularizar.');
          window.clearInterval(interval);
          return;
        }
      } catch (error) {
        console.warn('Falha ao atualizar status da cobrança PIX:', error);
      } finally {
        setIsRefreshingStatus(false);
      }
    }, 5000);

    return () => window.clearInterval(interval);
  }, [isOpen, paymentId, establishmentId, onPaid]);

  const handleGeneratePix = async () => {
    setIsGenerating(true);
    setStatusMessage('');
    setConfigError('');
    try {
      const endpoint = import.meta.env.PROD
        ? '/.netlify/functions/mercadopago-create-establishment-billing'
        : '/api/mercadopago/create-establishment-billing';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          establishmentId,
          description: `Regularizacao Agendei Facil - ${establishmentName}`,
          payer: {
            email: `billing_${String(establishmentId).slice(0, 8)}@agendeifacil.com`,
          },
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        const message = String(payload?.userMessage || payload?.error || `Erro ${response.status}`);
        setConfigError(message);
        throw new Error(message);
      }

      const trx = (payload as any)?.point_of_interaction?.transaction_data || {};
      const qrCode = String(trx?.qr_code || '').trim();
      const qrBase64Raw = String(trx?.qr_code_base64 || '').trim();
      if (!qrCode && !qrBase64Raw) {
        throw new Error('Nao foi possível gerar QR Code PIX.');
      }

      setPixCode(qrCode);
      setPixQrBase64(qrBase64Raw ? `data:image/png;base64,${qrBase64Raw}` : '');
      setPaymentId(String((payload as any)?.id || ''));
      const amountUsed = Number((payload as any)?.amount_brl_used ?? 0);
      if (Number.isFinite(amountUsed) && amountUsed > 0) {
        setBillingAmount(amountUsed);
      }
      setStatusMessage('PIX gerado! Após o pagamento, o sistema regulariza automaticamente.');
    } catch (error: any) {
      console.error('Erro ao gerar PIX de regularização:', error);
      setStatusMessage(String(error?.message || 'Erro ao gerar PIX.'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyPix = async () => {
    try {
      if (!pixCode) return;
      await navigator.clipboard.writeText(pixCode);
      setStatusMessage('Código PIX copiado.');
    } catch (error) {
      console.error('Erro ao copiar código PIX:', error);
      setStatusMessage('Não foi possível copiar automaticamente. Copie manualmente.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[12000] p-4">
      <div className="bg-[#151618] border border-gray-700 rounded-xl w-full max-w-xl text-white">
        <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3">
          <h3 className="font-bold text-base sm:text-lg">Regularizar pagamento do sistema</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          <div className="rounded-lg border border-gray-700 bg-[#1c1d20] p-3">
            <p className="text-sm text-gray-300">
              Estabelecimento: <span className="text-white font-semibold">{establishmentName}</span>
            </p>
            <p className="text-sm text-gray-300 mt-1">
              Valor cobrança MP:{' '}
              <span className="text-emerald-300 font-bold">
                {billingAmount > 0 ? formatBRL(billingAmount) : 'Definido no Admin'}
              </span>
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setSelectedMethod('pix')}
              className={`rounded-lg border px-4 py-3 text-left transition-colors ${selectedMethod === 'pix'
                ? 'border-emerald-400 bg-emerald-500/20'
                : 'border-gray-700 bg-[#1c1d20] hover:border-gray-500'
                }`}
            >
              <p className="font-semibold">PIX</p>
              <p className="text-xs text-gray-300 mt-1">QR Code e copia e cola</p>
            </button>

            <button
              type="button"
              onClick={() => setSelectedMethod('credit_card')}
              className={`rounded-lg border px-4 py-3 text-left transition-colors ${selectedMethod === 'credit_card'
                ? 'border-blue-400 bg-blue-500/20'
                : 'border-gray-700 bg-[#1c1d20] hover:border-gray-500'
                }`}
            >
              <p className="font-semibold">Cartão de crédito</p>
              <p className="text-xs text-gray-300 mt-1">Em breve</p>
            </button>
          </div>

          {selectedMethod === 'pix' && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleGeneratePix}
                disabled={isGenerating || isLoadingAmount}
                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed text-black font-bold py-3 rounded-lg transition-colors inline-flex items-center justify-center gap-2"
              >
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                {isGenerating ? 'Gerando PIX...' : 'Gerar PIX'}
              </button>

              {pixQrBase64 ? (
                <div className="flex justify-center">
                  <img src={pixQrBase64} alt="QR Code PIX" className="w-56 h-56 rounded-lg bg-white p-2" />
                </div>
              ) : null}

              {pixCode ? (
                <div className="space-y-2">
                  <p className="text-xs text-gray-300 text-center">PIX copia e cola</p>
                  <textarea
                    value={pixCode}
                    readOnly
                    rows={4}
                    className="w-full rounded-lg bg-[#0f1012] border border-gray-700 text-xs text-gray-100 p-3 resize-none"
                  />
                  <button
                    type="button"
                    onClick={handleCopyPix}
                    className="w-full border border-gray-600 hover:border-gray-400 rounded-lg py-2 font-semibold inline-flex items-center justify-center gap-2"
                  >
                    <Copy className="h-4 w-4" />
                    Copiar codigo PIX
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {selectedMethod === 'credit_card' && (
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-100 inline-flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Cartão de crédito será disponibilizado na próxima etapa. Use PIX por enquanto.
            </div>
          )}

          {(configError || statusMessage) && (
            <div className={`rounded-lg border p-3 text-sm ${configError
              ? 'border-red-500/40 bg-red-500/10 text-red-100'
              : statusMessage.toLowerCase().includes('confirmado')
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
                : 'border-gray-600 bg-[#1c1d20] text-gray-200'
              }`}>
              {configError || statusMessage}
            </div>
          )}

          {paymentId && (
            <p className="text-xs text-gray-400 text-center">
              Pagamento em verificação automática {isRefreshingStatus ? '(atualizando...)' : ''}.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
