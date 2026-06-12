import { Calendar, Shield, ShieldCheck, ShieldOff } from 'lucide-react';
import React, { useMemo } from 'react';
import {
  buildPartnerFreeMonthlyViewFromSummary,
  type PartnerFreeMonthlyHistoryRow,
  type PartnerFreeMonthlyView,
} from '../lib/partnerReferralFreeMonthly';
import type { PartnerReferralsDashboardSummary } from '../lib/partnerReferralDashboard';

type PartnerFreeMonthlySectionProps = {
  summary: PartnerReferralsDashboardSummary | null;
  paymentDueDate?: string | null;
  history?: PartnerFreeMonthlyHistoryRow[];
  isLoading?: boolean;
};

const toneClass = (tone: PartnerFreeMonthlyView['statusTone']) => {
  if (tone === 'active') return 'border-emerald-300 bg-emerald-50 text-emerald-900';
  if (tone === 'progress') return 'border-amber-300 bg-amber-50 text-amber-900';
  if (tone === 'lost') return 'border-red-300 bg-red-50 text-red-900';
  return 'border-gray-300 bg-gray-50 text-gray-800';
};

export const PartnerFreeMonthlySection: React.FC<PartnerFreeMonthlySectionProps> = ({
  summary,
  paymentDueDate,
  history = [],
  isLoading = false,
}) => {
  const view = useMemo(() => {
    if (!summary) return null;
    return buildPartnerFreeMonthlyViewFromSummary(summary, paymentDueDate, history);
  }, [summary, paymentDueDate, history]);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-6 text-center text-emerald-800/70">
        Carregando mensalidade grátis...
      </div>
    );
  }

  if (!view || !summary) return null;

  const StatusIcon = view.isProtectedThisCycle ? ShieldCheck : view.lostBenefitHint ? ShieldOff : Shield;

  return (
    <div className="rounded-2xl border-2 border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-5 sm:p-6 shadow-lg space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0 shadow-md">
          <StatusIcon className="w-6 h-6 text-white" />
        </div>
        <div className="min-w-0">
          <h3 className="text-xl font-extrabold text-gray-900">Mensalidade grátis por indicações</h3>
          <p className="text-sm text-gray-600 mt-1">
            3 indicados ativos = mensalidade grátis enquanto permanecerem ativos.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className={`rounded-xl border p-4 ${toneClass(view.statusTone)}`}>
          <p className="text-xs font-bold uppercase tracking-wide opacity-80">Status</p>
          <p className="mt-2 text-lg font-black leading-snug">{view.statusLabel}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Clientes ativos</p>
          <p className="mt-2 text-3xl font-black text-gray-900">{view.progressLabel}</p>
          <p className="mt-1 text-xs text-gray-600">{summary.freeMonthMessage}</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-blue-800 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            Próximo vencimento
          </p>
          <p className="mt-2 text-2xl font-black text-gray-900">{view.nextDueDateLabel}</p>
          <p className="mt-1 text-xs text-gray-500">Data do seu estabelecimento (referência visual).</p>
        </div>
      </div>

      <div
        className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${
          view.isProtectedThisCycle
            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
            : view.lostBenefitHint
              ? 'border-red-200 bg-red-50 text-red-900'
              : 'border-amber-200 bg-amber-50 text-amber-900'
        }`}
      >
        {view.protectionMessage}
      </div>

      {view.activeCount >= 4 && (
        <p className="text-xs text-gray-600">
          💡 Com {view.activeCount} ativos, os 3 primeiros cobrem sua mensalidade e{' '}
          {view.activeCount - 3} indicado{view.activeCount - 3 === 1 ? '' : 's'} geram lucro (R$8/mês cada).
        </p>
      )}
    </div>
  );
};
