import { Copy, Gift, Link as LinkIcon, MessageCircle, Rocket } from 'lucide-react';
import React, { useState } from 'react';
import type { PartnerReferralCodeRow } from '../lib/partnerReferral';
import { PartnerReferralShareModal } from './PartnerReferralShareModal';

type PartnerReferralHeroSectionProps = {
  partnerCode: PartnerReferralCodeRow | null;
  isLoadingCupom?: boolean;
  cupomError?: string | null;
  draftCode?: string;
  isSaving?: boolean;
  referralLink?: string;
  onDraftChange?: (value: string) => void;
  onSaveCode?: () => void;
  onCopyCupom?: () => void;
  onCopyLink?: () => void;
  onShareWhatsApp?: () => void;
};

export const PartnerReferralHeroSection: React.FC<PartnerReferralHeroSectionProps> = ({
  partnerCode,
  isLoadingCupom = false,
  cupomError = null,
  draftCode = '',
  isSaving = false,
  referralLink = '',
  onDraftChange,
  onSaveCode,
  onCopyCupom,
  onCopyLink,
  onShareWhatsApp,
}) => {
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const hasCupom = Boolean(partnerCode?.code);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-500/20 via-emerald-600/10 to-[#0f172a] p-5 sm:p-7 shadow-lg shadow-amber-500/10">
      <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-amber-400/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 h-32 w-32 rounded-full bg-emerald-400/15 blur-3xl pointer-events-none" />

      <div className="relative z-10 space-y-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">
            💰 Ganhe Dinheiro Indicando o Agendei Fácil
          </h1>
          <p className="mt-3 text-base sm:text-lg font-bold text-amber-100 leading-snug">
            Indique barbeiros e ganhe{' '}
            <span className="text-white">R$8 TODOS OS MESES por cada indicado ativo.</span>
          </p>
        </div>

        <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 space-y-1.5">
          <p className="text-sm font-extrabold text-emerald-100">🔥 3 indicados = sistema grátis</p>
          <p className="text-sm font-extrabold text-emerald-100">💸 4º indicado em diante = lucro recorrente todo mês</p>
          <p className="text-sm font-black text-white mt-2">500 indicados = quase R$4 mil/mês</p>
        </div>

        {isLoadingCupom ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center text-sm text-white/60">
            Carregando cupom...
          </div>
        ) : cupomError ? (
          <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-100">{cupomError}</div>
        ) : hasCupom ? (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setShareModalOpen(true)}
              className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-extrabold text-base sm:text-lg shadow-lg shadow-amber-500/25 hover:from-amber-400 hover:to-amber-500 transition-all inline-flex items-center justify-center gap-2"
            >
              <Rocket className="w-5 h-5" />
              Compartilhar e Ganhar Mais
            </button>

            <div className="rounded-xl border border-white/15 bg-[#0f172a]/80 p-4 sm:p-5 space-y-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-amber-300/90">Seu cupom</p>
                <p className="mt-1 text-3xl sm:text-4xl font-black text-white tracking-wide">{partnerCode?.code}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={onCopyCupom}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 px-4 py-3 text-sm font-bold text-white transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  Copiar cupom
                </button>
                <button
                  type="button"
                  onClick={onCopyLink}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 px-4 py-3 text-sm font-bold text-white transition-colors"
                >
                  <LinkIcon className="w-4 h-4" />
                  Copiar link
                </button>
                <button
                  type="button"
                  onClick={onShareWhatsApp}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-3 text-sm font-bold text-white transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp
                </button>
              </div>

              {referralLink && (
                <p className="text-xs text-white/50 break-all font-mono bg-black/20 rounded-lg px-3 py-2">{referralLink}</p>
              )}
            </div>

            <PartnerReferralShareModal
              isOpen={shareModalOpen}
              onClose={() => setShareModalOpen(false)}
              cupomCode={partnerCode!.code}
            />
          </div>
        ) : (
          <div className="rounded-xl border border-white/15 bg-[#0f172a]/80 p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-amber-400" />
              <p className="text-sm font-bold text-white">Crie seu cupom para começar a ganhar</p>
            </div>
            <input
              type="text"
              value={draftCode}
              onChange={(e) => onDraftChange?.(e.target.value)}
              placeholder="BITELO"
              maxLength={20}
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-xl border-2 border-white/20 bg-black/30 px-4 py-3 text-lg font-bold uppercase tracking-wider text-white placeholder:text-white/30 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 outline-none"
            />
            <button
              type="button"
              disabled={isSaving || draftCode.length < 3}
              onClick={onSaveCode}
              className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-extrabold text-base disabled:opacity-50 shadow-lg shadow-amber-500/25"
            >
              {isSaving ? 'Salvando...' : '🚀 Criar Meu Cupom'}
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
