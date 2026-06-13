import React from 'react';
import {
  PARTNER_REFERRAL_HOW_IT_WORKS_STEPS,
  PARTNER_REFERRAL_V2_HOW_IT_WORKS_FOOTNOTE,
  PARTNER_REFERRAL_V2_HOW_IT_WORKS_STEPS,
} from '../lib/partnerReferralHowItWorks';

type PartnerReferralHowItWorksSectionProps = {
  variant?: 'default' | 'compact';
  hasCupom?: boolean;
  cupomCode?: string | null;
  onShareWhatsApp?: () => void;
  onCopyCupom?: () => void;
};

export const PartnerReferralHowItWorksSection: React.FC<PartnerReferralHowItWorksSectionProps> = ({
  variant = 'default',
}) => {
  if (variant === 'compact') {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        <h2 className="text-lg font-extrabold text-white mb-4">Como ganhar dinheiro</h2>
        <div className="space-y-0">
          {PARTNER_REFERRAL_V2_HOW_IT_WORKS_STEPS.map((step, index) => (
            <React.Fragment key={step.label}>
              <div
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                  step.highlight
                    ? 'bg-amber-500/10 border-amber-400/30'
                    : 'bg-[#0f172a]/80 border-white/10'
                }`}
              >
                <span className="text-xl shrink-0" aria-hidden="true">
                  {step.emoji}
                </span>
                <span
                  className={`text-sm sm:text-base font-semibold leading-snug ${
                    step.highlight ? 'text-amber-100' : 'text-white/95'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {index < PARTNER_REFERRAL_V2_HOW_IT_WORKS_STEPS.length - 1 && (
                <div className="flex justify-center py-1 text-amber-300/80 text-lg font-bold" aria-hidden="true">
                  ↓
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
        <p className="mt-4 text-sm text-white/60 italic leading-relaxed">{PARTNER_REFERRAL_V2_HOW_IT_WORKS_FOOTNOTE}</p>
      </section>
    );
  }

  // Layout legado (default) — mantido para compatibilidade se usado em outro lugar
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-8 shadow-lg space-y-8 overflow-hidden">
      <div>
        <h3 className="text-xl sm:text-2xl font-extrabold text-gray-900 leading-tight">
          🚀 Como ganhar com o Agendei Fácil
        </h3>
        <p className="mt-2 text-sm text-gray-600">Simples, rápido e recorrente.</p>
      </div>

      <div className="relative space-y-0">
        {PARTNER_REFERRAL_HOW_IT_WORKS_STEPS.map((step, index) => {
          const isLast = index === PARTNER_REFERRAL_HOW_IT_WORKS_STEPS.length - 1;
          return (
            <div key={step.id} className="relative flex gap-4 pb-8 last:pb-0">
              {!isLast && (
                <div className="absolute left-[1.125rem] top-10 bottom-0 w-0.5 bg-gradient-to-b from-emerald-300 to-amber-200" />
              )}
              <div className="relative z-10 w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-black bg-emerald-100 text-emerald-800 border-2 border-emerald-300">
                {index + 1}
              </div>
              <div className="flex-1 rounded-xl border border-gray-200 bg-gray-50/50 p-4 sm:p-5">
                <p className="text-base sm:text-lg font-extrabold text-gray-900">
                  {step.emoji} {step.title}
                </p>
                <p className="mt-2 text-sm text-gray-700 leading-relaxed">{step.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
