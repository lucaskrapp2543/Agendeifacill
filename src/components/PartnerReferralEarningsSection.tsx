import React from 'react';
import { PARTNER_REFERRAL_V2_EARNINGS_SCENARIOS } from '../lib/partnerReferralHowItWorks';

export const PartnerReferralEarningsSection: React.FC = () => {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6 space-y-4">
      <h2 className="text-lg sm:text-xl font-extrabold text-white">Quanto você pode ganhar</h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {PARTNER_REFERRAL_V2_EARNINGS_SCENARIOS.map((scenario) => (
          <div
            key={scenario.activeCount}
            className={`rounded-xl border p-4 text-center ${
              scenario.isHighlight
                ? 'col-span-2 sm:col-span-3 border-amber-400/50 bg-gradient-to-br from-amber-500/20 to-amber-950/30'
                : scenario.isFree
                  ? 'border-emerald-400/40 bg-emerald-500/10'
                  : 'border-white/10 bg-[#0f172a]/60'
            }`}
          >
            <p className="text-xs font-bold text-white/60">{scenario.activeCount} indicados</p>
            <p className="mt-2 text-lg sm:text-xl font-black text-white leading-tight">
              {scenario.emoji} {scenario.profitLabel}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};
