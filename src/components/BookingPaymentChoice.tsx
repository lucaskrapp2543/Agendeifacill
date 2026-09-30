import React, { useState } from 'react';

/**
 * Escolha de pagamento padrão do booking (página completa, simples e chat):
 *   1. Pagar com PIX (destaque)
 *   2. Pagar com cartão → crédito ou débito
 *   3. "Prefiro pagar no local" (discreto) → antes de aceitar, mostra o que o
 *      cliente perde pagando depois (AFCoins / horário garantido) e pede confirmação.
 *
 * Só apresentação: quem decide o que acontece em cada escolha é a página
 * (onPay abre o PaymentModal, onPayLocal confirma o agendamento como "pagar no local").
 */

export type BookingPayMethod = 'pix' | 'credit_card' | 'debit_card';

type Props = {
  /** Valor que será cobrado agora (já com a taxa de R$ 1, se o estabelecimento repassa). */
  chargeAmount: number;
  /** Se for 50%: quanto fica para pagar no local. */
  remainingLocalAmount?: number;
  establishmentName?: string;
  afcoinsEnabled: boolean;
  /** AFCoins que o cliente ganha pagando online / no local (só para o texto). */
  afcoinsOnline?: number;
  afcoinsLocal?: number;
  onPay: (method: BookingPayMethod) => void;
  onPayLocal: () => void;
  busy?: boolean;
  /** 'modal' = sobre a página (página completa). 'inline' = dentro do fluxo (página simples). */
  variant?: 'modal' | 'inline';
  onExplainAfcoins?: () => void;
};

const GOLD = '#E6C78B';

const brl = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const BookingPaymentChoice: React.FC<Props> = ({
  chargeAmount,
  remainingLocalAmount,
  establishmentName,
  afcoinsEnabled,
  afcoinsOnline = 45,
  afcoinsLocal = 3,
  onPay,
  onPayLocal,
  busy = false,
  variant = 'modal',
  onExplainAfcoins,
}) => {
  const [step, setStep] = useState<'choose' | 'card' | 'local'>('choose');
  const nome = String(establishmentName || '').trim() || 'aqui';
  const temRestante = Number(remainingLocalAmount || 0) > 0;

  const optionBase =
    'w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed';

  const content = (
    <div className="text-white">
      {step === 'choose' && (
        <>
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-200">
              🔒 Pagamento seguro
            </span>
            {afcoinsEnabled && (
              <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold" style={{ borderColor: 'rgba(230,199,139,0.4)', color: GOLD, background: 'rgba(230,199,139,0.08)' }}>
                🪙 +{afcoinsOnline} AFCoins pagando online
              </span>
            )}
          </div>

          <h2 className="mt-3 text-xl sm:text-2xl font-extrabold text-white leading-tight">Como você prefere pagar?</h2>
          <p className="mt-1 text-3xl sm:text-4xl font-black text-white tracking-tight">{brl(chargeAmount)}</p>
          {temRestante ? (
            <p className="mt-1 text-sm text-gray-400">
              50% agora · restante de <span className="font-bold text-gray-200">{brl(remainingLocalAmount || 0)}</span> no local
            </p>
          ) : (
            <p className="mt-1 text-sm text-gray-400">Escolha uma opção abaixo 👇</p>
          )}

          <div className="mt-4 space-y-2.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => onPay('pix')}
              className={`${optionBase} bg-gradient-to-r from-emerald-500 to-green-600 shadow-lg shadow-emerald-500/20 hover:brightness-105`}
            >
              <span className="h-11 w-11 shrink-0 rounded-xl bg-white/15 grid place-items-center text-2xl" aria-hidden>💠</span>
              <span className="flex-1 min-w-0">
                <span className="block text-base font-extrabold text-white">Pagar com PIX</span>
                <span className="block text-xs text-emerald-50/90">Aprovado na hora</span>
              </span>
              <span className="text-white/80 text-xl" aria-hidden>›</span>
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => setStep('card')}
              className={`${optionBase} border border-white/15 bg-white/[0.05] hover:bg-white/[0.09] hover:border-white/25`}
            >
              <span className="h-11 w-11 shrink-0 rounded-xl bg-white/10 grid place-items-center text-2xl" aria-hidden>💳</span>
              <span className="flex-1 min-w-0">
                <span className="block text-base font-extrabold text-white">Pagar com cartão</span>
                <span className="block text-xs text-gray-400">Crédito ou débito</span>
              </span>
              <span className="text-gray-400 text-xl" aria-hidden>›</span>
            </button>
          </div>

          {busy && (
            <p className="mt-3 text-center text-xs text-gray-400">Abrindo pagamento…</p>
          )}

          <div className="mt-5 flex flex-col items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setStep('local')}
              className="text-xs text-gray-500 hover:text-gray-300 underline underline-offset-4 decoration-gray-700 hover:decoration-gray-400 transition-colors"
            >
              Prefiro pagar no local
            </button>
            {afcoinsEnabled && onExplainAfcoins && (
              <button
                type="button"
                onClick={onExplainAfcoins}
                className="text-[11px] font-semibold hover:underline underline-offset-4"
                style={{ color: GOLD }}
              >
                🪙 O que é AFCoins?
              </button>
            )}
          </div>
        </>
      )}

      {step === 'card' && (
        <>
          <button
            type="button"
            onClick={() => setStep('choose')}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            ‹ Voltar
          </button>
          <h2 className="mt-2 text-xl sm:text-2xl font-extrabold text-white leading-tight">Crédito ou débito?</h2>
          <p className="mt-1 text-sm text-gray-400">{brl(chargeAmount)} no cartão, aprovado na hora.</p>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => onPay('credit_card')}
              className="rounded-2xl border border-white/15 bg-white/[0.05] hover:bg-white/[0.09] px-3 py-5 text-center transition-all active:scale-[0.99] disabled:opacity-50"
            >
              <span className="block text-2xl" aria-hidden>💳</span>
              <span className="mt-1 block text-base font-extrabold text-white">Crédito</span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onPay('debit_card')}
              className="rounded-2xl border border-white/15 bg-white/[0.05] hover:bg-white/[0.09] px-3 py-5 text-center transition-all active:scale-[0.99] disabled:opacity-50"
            >
              <span className="block text-2xl" aria-hidden>🏧</span>
              <span className="mt-1 block text-base font-extrabold text-white">Débito</span>
            </button>
          </div>
        </>
      )}

      {step === 'local' && (
        <>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white leading-tight">Tem certeza? 🤔</h2>
          {afcoinsEnabled ? (
            <div className="mt-3 rounded-2xl border p-4" style={{ borderColor: 'rgba(230,199,139,0.35)', background: 'rgba(230,199,139,0.07)' }}>
              <p className="text-sm text-gray-200 leading-relaxed">
                Pagando online agora você ganha{' '}
                <strong style={{ color: GOLD }}>+{afcoinsOnline} AFCoins</strong> (no local são só +{afcoinsLocal}) e concorre a{' '}
                <strong className="text-white">corte 100% grátis</strong> todo mês na {nome} 🎁
              </p>
              <ul className="mt-3 space-y-1.5 text-xs text-gray-300">
                <li>🪙 AFCoins viram cortes grátis, descontos e produtos</li>
                <li>🔒 Horário garantido, sem risco de perder a vaga</li>
                <li>⚡ Sem fila no caixa: chega, é atendido e sai</li>
              </ul>
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-sm text-gray-200 leading-relaxed">
                Pagando agora seu horário fica garantido e você não precisa se preocupar com isso na hora 😉
              </p>
              <ul className="mt-3 space-y-1.5 text-xs text-gray-300">
                <li>🔒 Horário garantido, sem risco de perder a vaga</li>
                <li>⚡ Sem fila no caixa: chega, é atendido e sai</li>
                <li>✅ Pagamento 100% seguro, aprovado na hora</li>
              </ul>
            </div>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={() => setStep('choose')}
            className="mt-4 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-3.5 text-base font-extrabold text-white shadow-lg shadow-emerald-500/20 hover:brightness-105 active:scale-[0.99] disabled:opacity-50"
          >
            Ok, vou pagar agora 💳
          </button>
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              disabled={busy}
              onClick={onPayLocal}
              className="text-xs text-gray-500 hover:text-gray-300 underline underline-offset-4 decoration-gray-700 hover:decoration-gray-400 transition-colors disabled:opacity-50"
            >
              {busy ? 'Confirmando…' : 'Pagar no local mesmo assim'}
            </button>
          </div>
        </>
      )}
    </div>
  );

  if (variant === 'inline') {
    return (
      <div className="w-full rounded-3xl border border-white/10 bg-[#141517] p-5 sm:p-6">
        {content}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4">
      <div
        className="w-full max-w-md rounded-3xl border p-5 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto"
        style={{
          background: 'radial-gradient(120% 160% at 0% 0%, rgba(230,199,139,0.10) 0%, rgba(15,16,18,0.99) 45%, rgba(9,9,11,1) 100%)',
          borderColor: 'rgba(230,199,139,0.28)',
        }}
      >
        {content}
      </div>
    </div>
  );
};

export default BookingPaymentChoice;
