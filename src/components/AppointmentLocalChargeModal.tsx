import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, Loader2, QrCode, X } from 'lucide-react';
import {
  cancelAppointmentLocalCharge,
  createAppointmentLocalCharge,
  fetchAppointmentLocalCharge,
} from '../lib/appointmentLocalCharge';

interface AppointmentLocalChargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointmentId: string;
  clientName: string;
  /** Chamado quando o pagamento é confirmado, para o card atualizar sozinho. */
  onPaid?: () => void;
}

const formatBRL = (cents: number) =>
  (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * 💳 COBRAR CLIENTE — mostra o QR Code do PIX para o cliente pagar no balcão.
 *
 * Não conclui, não confirma e não altera o agendamento de forma alguma. Quando
 * o cliente paga, o webhook do Mercado Pago marca a cobrança como paga e esta
 * tela percebe na próxima verificação.
 */
export const AppointmentLocalChargeModal: React.FC<AppointmentLocalChargeModalProps> = ({
  isOpen,
  onClose,
  appointmentId,
  clientName,
  onPaid,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [qrCodeBase64, setQrCodeBase64] = useState('');
  const [amountCents, setAmountCents] = useState(0);
  const [chargeId, setChargeId] = useState<string | null>(null);
  const [isPaid, setIsPaid] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const paidNotifiedRef = useRef(false);

  useEffect(() => {
    if (isOpen) return;
    setIsGenerating(false);
    setErrorMessage('');
    setQrCode('');
    setQrCodeBase64('');
    setAmountCents(0);
    setChargeId(null);
    setIsPaid(false);
    setCopied(false);
    setIsCancelling(false);
    paidNotifiedRef.current = false;
  }, [isOpen]);

  // Gera (ou reaproveita) a cobrança assim que a tela abre.
  useEffect(() => {
    if (!isOpen || !appointmentId) return;
    let cancelled = false;

    const generate = async () => {
      setIsGenerating(true);
      setErrorMessage('');
      const result = await createAppointmentLocalCharge(appointmentId);
      if (cancelled) return;

      if (!result.ok) {
        setErrorMessage(result.message);
        setIsGenerating(false);
        return;
      }

      if (result.alreadyPaid) {
        setIsPaid(true);
        setAmountCents(result.amountCents);
        setIsGenerating(false);
        return;
      }

      setChargeId(result.chargeId);
      setQrCode(result.qrCode);
      setQrCodeBase64(result.qrCodeBase64);
      setAmountCents(result.amountCents);
      if (result.warning === 'nao_registrado') {
        setErrorMessage(
          'QR Code gerado, mas houve falha ao registrar. Confira o pagamento direto no seu Mercado Pago.'
        );
      }
      setIsGenerating(false);
    };

    void generate();
    return () => { cancelled = true; };
  }, [isOpen, appointmentId]);

  // Verificação automática — quem marca como paga é o webhook; aqui só lemos.
  useEffect(() => {
    if (!isOpen || isPaid || !appointmentId) return;
    const interval = window.setInterval(async () => {
      const charge = await fetchAppointmentLocalCharge(appointmentId);
      if (charge?.status === 'paid') {
        setIsPaid(true);
        setAmountCents(charge.amountCents);
      }
    }, 5000);
    return () => window.clearInterval(interval);
  }, [isOpen, isPaid, appointmentId]);

  useEffect(() => {
    if (!isPaid || paidNotifiedRef.current) return;
    paidNotifiedRef.current = true;
    onPaid?.();
  }, [isPaid, onPaid]);

  const handleCopy = async () => {
    if (!qrCode) return;
    try {
      await navigator.clipboard.writeText(qrCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setErrorMessage('Não foi possível copiar automaticamente. Selecione o código e copie manualmente.');
    }
  };

  const handleCancelCharge = async () => {
    if (!chargeId) { onClose(); return; }
    setIsCancelling(true);
    await cancelAppointmentLocalCharge(chargeId);
    setIsCancelling(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-3 sm:p-4">
      <div className="w-full max-w-md bg-[#141516] border border-gray-700 rounded-2xl shadow-2xl flex flex-col max-h-[92dvh] text-white">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-800 flex-shrink-0">
          <h3 className="font-bold text-base text-white flex items-center gap-2">
            <QrCode className="h-5 w-5 text-emerald-400" />
            Cobrar cliente
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-4 py-4 overflow-y-auto space-y-3">
          {isGenerating && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Loader2 className="h-7 w-7 animate-spin text-emerald-400" />
              <span className="text-sm text-gray-300">Gerando o PIX...</span>
            </div>
          )}

          {!isGenerating && isPaid && (
            <div className="rounded-2xl border border-emerald-500/50 bg-emerald-500/10 p-5 text-center">
              <div className="text-4xl mb-2">✅</div>
              <p className="text-lg font-extrabold text-emerald-300">Pagamento confirmado!</p>
              {amountCents > 0 && (
                <p className="text-2xl font-black text-white mt-1">{formatBRL(amountCents)}</p>
              )}
              <p className="text-sm text-emerald-100/90 mt-2 leading-relaxed">
                O dinheiro caiu na sua conta do Mercado Pago. Este atendimento agora conta na sua{' '}
                <strong className="text-white">Meta Mensal</strong>.
              </p>
              <p className="text-[12px] text-gray-400 mt-2">
                O agendamento não foi alterado — conclua normalmente quando quiser.
              </p>
            </div>
          )}

          {!isGenerating && !isPaid && errorMessage && !qrCode && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
              {errorMessage}
            </div>
          )}

          {!isGenerating && !isPaid && (qrCode || qrCodeBase64) && (
            <>
              <div className="rounded-xl border border-gray-700 bg-[#1c1d20] p-3 text-center">
                <p className="text-sm text-gray-300">
                  Cobrando <span className="text-white font-semibold">{clientName || 'cliente'}</span>
                </p>
                <p className="text-3xl font-black text-emerald-300 mt-1">{formatBRL(amountCents)}</p>
              </div>

              {qrCodeBase64 && (
                <div className="flex justify-center">
                  <img
                    src={`data:image/png;base64,${qrCodeBase64}`}
                    alt="QR Code do PIX"
                    className="w-56 h-56 rounded-xl bg-white p-2"
                  />
                </div>
              )}

              <p className="text-center text-sm text-gray-300">
                Mostre a tela para o cliente escanear
              </p>

              {qrCode && (
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`w-full py-3 rounded-xl font-extrabold transition-colors flex items-center justify-center gap-2 ${copied
                    ? 'bg-emerald-500 text-black'
                    : 'bg-gray-100 text-black hover:bg-white'
                    }`}
                >
                  {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                  {copied ? 'Código copiado!' : 'Copiar código PIX'}
                </button>
              )}

              <div className="flex items-center justify-center gap-2 text-[12px] text-gray-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Aguardando o pagamento...
              </div>

              {errorMessage && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-[12px] text-amber-200">
                  {errorMessage}
                </div>
              )}

              <p className="text-[11px] text-gray-500 text-center leading-relaxed">
                O valor cai direto na sua conta do Mercado Pago. Este atendimento passa a contar na
                sua Meta Mensal. O agendamento não é alterado.
              </p>
            </>
          )}
        </div>

        <div className="px-4 py-3 border-t border-gray-800 flex-shrink-0">
          {isPaid ? (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-emerald-500 text-black font-extrabold hover:bg-emerald-400 transition-colors"
            >
              Fechar
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleCancelCharge}
                disabled={isCancelling}
                className="py-3 rounded-xl border border-gray-600 text-gray-300 font-bold hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {isCancelling ? 'Cancelando...' : 'Cancelar cobrança'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="py-3 rounded-xl bg-gray-700 text-white font-bold hover:bg-gray-600 transition-colors"
              >
                Fechar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppointmentLocalChargeModal;
