import { MessageCircle, Rocket, Share2, Sparkles } from 'lucide-react';
import React from 'react';
import {
  PARTNER_REFERRAL_EARNINGS_SCENARIOS,
  PARTNER_REFERRAL_HOW_IT_WORKS_MILESTONE_PREVIEW,
  PARTNER_REFERRAL_HOW_IT_WORKS_STEPS,
  PARTNER_REFERRAL_PROFIT_EXAMPLES,
} from '../lib/partnerReferralHowItWorks';

type PartnerReferralHowItWorksSectionProps = {
  hasCupom?: boolean;
  cupomCode?: string | null;
  onShareWhatsApp?: () => void;
  onCopyCupom?: () => void;
};

export const PartnerReferralHowItWorksSection: React.FC<PartnerReferralHowItWorksSectionProps> = ({
  hasCupom = false,
  cupomCode,
  onShareWhatsApp,
  onCopyCupom,
}) => {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-8 shadow-lg space-y-8 overflow-hidden">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shrink-0">
          <Rocket className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-xl sm:text-2xl font-extrabold text-gray-900 leading-tight">
            🚀 Como ganhar com o Agendei Fácil
          </h3>
          <p className="mt-2 text-sm text-gray-600">Simples, rápido e recorrente. Veja o passo a passo.</p>
        </div>
      </div>

      <div className="relative space-y-0">
        {PARTNER_REFERRAL_HOW_IT_WORKS_STEPS.map((step, index) => {
          const isLast = index === PARTNER_REFERRAL_HOW_IT_WORKS_STEPS.length - 1;
          return (
            <div key={step.id} className="relative flex gap-4 pb-8 last:pb-0">
              {!isLast && (
                <div className="absolute left-[1.125rem] top-10 bottom-0 w-0.5 bg-gradient-to-b from-emerald-300 to-amber-200" />
              )}
              <div
                className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-black ${
                  step.highlight
                    ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-lg ring-4 ring-amber-100'
                    : 'bg-emerald-100 text-emerald-800 border-2 border-emerald-300'
                }`}
              >
                {index + 1}
              </div>
              <div
                className={`flex-1 rounded-xl border p-4 sm:p-5 ${
                  step.highlight
                    ? 'border-amber-300 bg-gradient-to-br from-amber-50 via-white to-emerald-50 shadow-md ring-1 ring-amber-200/80'
                    : 'border-gray-200 bg-gray-50/50'
                }`}
              >
                <p className="text-base sm:text-lg font-extrabold text-gray-900">
                  {step.emoji} {step.title}
                </p>
                <p className="mt-2 text-sm text-gray-700 leading-relaxed">{step.description}</p>
                {step.exampleLabel && (
                  <p className="mt-3 inline-block rounded-lg bg-gray-900 px-4 py-2 text-lg font-black tracking-widest text-amber-300">
                    {step.exampleLabel}
                  </p>
                )}
                {step.id === 'profit-four-plus' && (
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {PARTNER_REFERRAL_PROFIT_EXAMPLES.map((example) => (
                      <div
                        key={example.activeCount}
                        className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-center"
                      >
                        <p className="text-xs font-bold text-gray-500">{example.activeCount} parceiros</p>
                        <p className="text-sm font-black text-emerald-700">{example.profitLabel}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-600" />
          <h4 className="text-lg sm:text-xl font-extrabold text-gray-900">💸 Quanto você pode ganhar?</h4>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
          {PARTNER_REFERRAL_EARNINGS_SCENARIOS.map((scenario) => (
            <div
              key={scenario.activeCount}
              className={`rounded-xl border p-3 sm:p-4 text-center ${
                scenario.isMax
                  ? 'border-amber-400 bg-gradient-to-br from-amber-100 via-amber-50 to-white col-span-2 sm:col-span-3 lg:col-span-4 shadow-md ring-1 ring-amber-200/80'
                  : scenario.isFree
                    ? 'border-emerald-300 bg-emerald-50/80'
                    : 'border-gray-200 bg-white'
              }`}
            >
              <p className="text-xs font-bold text-gray-500">{scenario.label}</p>
              <p
                className={`mt-1 text-sm sm:text-base font-black leading-tight ${
                  scenario.isFree ? 'text-emerald-700' : scenario.isMax ? 'text-amber-900' : 'text-gray-900'
                }`}
              >
                {scenario.isFree ? '✅ ' : scenario.isMax ? '👑 ' : '💰 '}
                {scenario.profitLabel}
              </p>
              {scenario.isMax && (
                <p className="mt-1 text-[10px] sm:text-xs font-semibold text-amber-800/80">
                  Teto máximo do programa
                </p>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-600 text-center">
          Quanto mais barbeiros ativos você indicar, maior seu lucro mensal.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 sm:p-5 space-y-3">
        <p className="text-sm font-extrabold text-gray-900">🎯 Metas e premiações</p>
        <div className="flex flex-wrap gap-2">
          {PARTNER_REFERRAL_HOW_IT_WORKS_MILESTONE_PREVIEW.map((milestone) => (
            <span
              key={milestone.threshold}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800"
            >
              {milestone.emoji} {milestone.threshold} → {milestone.title}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        {hasCupom ? (
          <>
            <button
              type="button"
              onClick={onShareWhatsApp}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 px-6 shadow-md transition-colors"
            >
              <MessageCircle className="w-5 h-5" />
              📤 Compartilhar meu cupom
            </button>
            <button
              type="button"
              onClick={onCopyCupom}
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-gray-900 text-gray-900 hover:bg-gray-50 font-bold py-3.5 px-6 transition-colors"
            >
              <Share2 className="w-4 h-4" />
              Copiar {cupomCode || 'cupom'}
            </button>
          </>
        ) : (
          <p className="text-sm text-center text-gray-600 w-full py-2">
            Crie seu cupom no resumo acima e comece a indicar agora.
          </p>
        )}
      </div>
    </div>
  );
};
