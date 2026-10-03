import React from 'react';
import { noShowPolicyClientText, type NoShowPolicy } from '../lib/noShowPolicy';

/**
 * Aviso que o CLIENTE vê depois de pagar online, quando a barbearia ligou a política
 * de faltas. Também é usado como prévia na tela do dono (mode="preview").
 * Tom: comemorar o pagamento primeiro, combinado depois, nada agressivo.
 */
type Props = {
  policy: NoShowPolicy;
  establishmentName?: string;
  amountLabel?: string;
  mode?: 'overlay' | 'preview';
  onConfirm?: () => void;
};

export const NoShowPolicyNotice: React.FC<Props> = ({ policy, establishmentName, amountLabel, mode = 'overlay', onConfirm }) => {
  const texto = noShowPolicyClientText(policy, establishmentName);

  const card = (
    <div
      className="w-full max-w-sm rounded-3xl border p-5 sm:p-6 text-white shadow-2xl"
      style={{
        background: 'radial-gradient(120% 160% at 0% 0%, rgba(16,185,129,0.14) 0%, rgba(15,16,18,0.99) 45%, rgba(9,9,11,1) 100%)',
        borderColor: 'rgba(16,185,129,0.35)',
      }}
    >
      <div className="flex flex-col items-center text-center">
        <div className="h-16 w-16 rounded-full bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center text-3xl" aria-hidden>
          ✅
        </div>
        <p className="mt-3 text-xl font-extrabold text-white">Pagamento confirmado!</p>
        {amountLabel ? <p className="mt-0.5 text-2xl font-black text-emerald-300">{amountLabel}</p> : null}
        <p className="mt-1 text-sm text-gray-300">Seu horário está garantido. Obrigado! 🙌</p>
      </div>

      {/* Lembrete leve: sem cor de alerta, texto pequeno, tom de conversa */}
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
        <p className="text-xs font-semibold text-gray-300">{texto.title}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-gray-400">{texto.body}</p>
      </div>

      {mode === 'overlay' ? (
        <button
          type="button"
          onClick={onConfirm}
          className="mt-4 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-3.5 text-base font-extrabold text-white shadow-lg shadow-emerald-500/20 hover:brightness-105 active:scale-[0.99]"
        >
          Combinado 👍
        </button>
      ) : (
        <div className="mt-4 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-3 text-center text-base font-extrabold text-white opacity-90">
          Combinado 👍
        </div>
      )}
    </div>
  );

  if (mode === 'preview') return card;

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4">
      {card}
    </div>
  );
};

export default NoShowPolicyNotice;
