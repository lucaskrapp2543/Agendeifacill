import { Lock, Sparkles, Trophy } from 'lucide-react';
import React, { useMemo } from 'react';
import {
  buildPartnerReferralMilestoneProgress,
  formatPartnerReferralMilestoneCount,
  type PartnerReferralMilestoneWithStatus,
} from '../lib/partnerReferralMilestones';

type PartnerReferralMilestonesSectionProps = {
  activeCount: number;
  isLoading?: boolean;
};

const milestoneCardClass = (milestone: PartnerReferralMilestoneWithStatus): string => {
  if (milestone.status === 'unlocked') {
    return 'border-emerald-300/80 bg-gradient-to-br from-emerald-50 via-white to-amber-50 shadow-md ring-1 ring-emerald-200/60';
  }
  if (milestone.status === 'next') {
    return 'border-amber-400 bg-gradient-to-br from-amber-100 via-amber-50 to-white shadow-lg ring-2 ring-amber-300/70 scale-[1.02]';
  }
  return 'border-gray-200 bg-gray-50/80 opacity-75';
};

export const PartnerReferralMilestonesSection: React.FC<PartnerReferralMilestonesSectionProps> = ({
  activeCount,
  isLoading = false,
}) => {
  const progress = useMemo(() => buildPartnerReferralMilestoneProgress(activeCount), [activeCount]);

  return (
    <div className="rounded-2xl border border-amber-200/70 bg-gradient-to-br from-gray-900 via-gray-900 to-emerald-950 p-5 sm:p-8 shadow-xl space-y-6 overflow-hidden relative">
      <div className="absolute top-0 right-0 w-48 h-48 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-40 h-40 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative flex items-start gap-4">
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shrink-0">
          <Trophy className="w-7 h-7 text-white" />
        </div>
        <div>
          <h3 className="text-xl sm:text-2xl font-extrabold text-white leading-tight">🏆 Metas e Premiações</h3>
          <p className="mt-2 text-sm sm:text-base text-amber-100/90 leading-relaxed">
            Acompanhe seu progresso e desbloqueie reconhecimentos exclusivos conforme seus indicados ativos crescem.
          </p>
          <p className="mt-1 text-xs text-gray-400">Somente visual — premiações entregues manualmente pelo AF.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="relative rounded-xl border border-white/10 bg-white/5 p-6 text-center text-amber-100/70">
          Carregando seu progresso...
        </div>
      ) : (
        <>
          <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-950/40 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-300">Indicados ativos agora</p>
              <p className="mt-2 text-4xl font-black text-white">
                {formatPartnerReferralMilestoneCount(progress.activeCount)}
              </p>
            </div>
            <div className="rounded-xl border border-amber-400/30 bg-amber-950/30 p-4 sm:col-span-2">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-300">Próxima premiação</p>
              {progress.nextMilestone ? (
                <>
                  <p className="mt-2 text-lg sm:text-xl font-extrabold text-white leading-snug">
                    {progress.nextMilestone.emoji} {progress.nextMilestone.title}
                  </p>
                  <p className="mt-1 text-sm text-amber-100/80">
                    Faltam{' '}
                    <strong className="text-amber-300">
                      {formatPartnerReferralMilestoneCount(progress.remainingToNext)}
                    </strong>{' '}
                    indicado{progress.remainingToNext === 1 ? '' : 's'} ativo
                    {progress.remainingToNext === 1 ? '' : 's'}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-lg font-extrabold text-amber-300">
                  🔥 Hall da Fama — meta máxima desbloqueada!
                </p>
              )}
            </div>
          </div>

          <div className="relative rounded-xl border border-white/10 bg-white/5 p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-amber-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Progresso rumo à próxima meta
              </span>
              <span className="font-black text-amber-300">{progress.progressPercent}%</span>
            </div>
            <div className="h-3 rounded-full bg-gray-800 overflow-hidden border border-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-amber-500 transition-all duration-700"
                style={{ width: `${progress.progressPercent}%` }}
              />
            </div>
            <p className="text-sm text-gray-200 leading-relaxed">{progress.progressMessage}</p>
            {progress.currentMilestone && (
              <p className="text-xs text-emerald-300/90">
                Meta atual desbloqueada: {progress.currentMilestone.emoji} {progress.currentMilestone.title}
              </p>
            )}
          </div>

          <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {progress.milestones.map((milestone) => (
              <div
                key={milestone.id}
                className={`relative rounded-xl border p-4 space-y-2 transition-all ${milestoneCardClass(milestone)}`}
              >
                {milestone.status === 'locked' && (
                  <div className="absolute top-3 right-3 text-gray-400">
                    <Lock className="w-4 h-4" />
                  </div>
                )}
                {milestone.status === 'next' && (
                  <span className="inline-block text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-200 px-2 py-0.5 rounded-full">
                    Próxima meta
                  </span>
                )}
                {milestone.status === 'unlocked' && (
                  <span className="inline-block text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-200 px-2 py-0.5 rounded-full">
                    Desbloqueada
                  </span>
                )}
                <p className="text-2xl">{milestone.emoji}</p>
                <p className="text-sm font-black text-gray-900 leading-snug">{milestone.title}</p>
                <p className="text-xs font-bold text-amber-700">
                  {formatPartnerReferralMilestoneCount(milestone.threshold)} indicados ativos
                </p>
                <p className="text-xs text-gray-600 leading-relaxed">{milestone.subtitle}</p>
                {milestone.estimateLabel && (
                  <p className="text-xs font-bold text-emerald-700">💰 Estimativa: {milestone.estimateLabel}</p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
