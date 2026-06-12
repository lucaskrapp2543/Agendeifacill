import { Copy, Gift, Link as LinkIcon, MessageCircle, Rocket, Sparkles, Wallet } from 'lucide-react';
import React, { useState } from 'react';
import { formatPartnerReferralMoney, type PartnerReferralsDashboardSummary } from '../lib/partnerReferralDashboard';
import type { PartnerReferralCodeRow } from '../lib/partnerReferral';
import { PartnerReferralShareModal } from './PartnerReferralShareModal';

type PartnerReferralSummarySectionProps = {
  partnerCode: PartnerReferralCodeRow | null;
  summary: PartnerReferralsDashboardSummary | null;
  isLoadingCupom?: boolean;
  isLoadingSummary?: boolean;
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

export const PartnerReferralSummarySection: React.FC<PartnerReferralSummarySectionProps> = ({
  partnerCode,
  summary,
  isLoadingCupom = false,
  isLoadingSummary = false,
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
  const showMetrics = !isLoadingSummary && summary;

  return (
    <div className="rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50 via-white to-emerald-50 p-5 sm:p-6 shadow-xl space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shrink-0">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 leading-tight">💰 Indique e Ganhe</h2>
          <p className="mt-1 text-sm text-gray-600">Seu resumo rápido do programa de parceiros.</p>
        </div>
      </div>

      {isLoadingCupom ? (
        <div className="rounded-xl border border-gray-200 bg-white/80 p-4 text-center text-sm text-gray-500">
          Carregando cupom...
        </div>
      ) : cupomError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{cupomError}</div>
      ) : partnerCode?.code ? (
        <div className="rounded-xl border border-emerald-200 bg-white p-4 sm:p-5 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Cupom exclusivo</p>
              <p className="mt-1 text-3xl sm:text-4xl font-black text-gray-900 tracking-wide">{partnerCode.code}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShareModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-3 py-2 text-xs font-extrabold text-black hover:from-amber-400 hover:to-amber-500 shadow-sm"
              >
                <Rocket className="w-3.5 h-3.5" />
                Compartilhar e Ganhar Mais
              </button>
              <button
                type="button"
                onClick={onCopyCupom}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-xs font-bold text-white hover:bg-black"
              >
                <Copy className="w-3.5 h-3.5" />
                Copiar
              </button>
              <button
                type="button"
                onClick={onCopyLink}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-900 hover:bg-gray-50"
              >
                <LinkIcon className="w-3.5 h-3.5" />
                Link
              </button>
              <button
                type="button"
                onClick={onShareWhatsApp}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                WhatsApp
              </button>
            </div>
          </div>
          {referralLink && (
            <p className="text-xs text-gray-500 break-all font-mono bg-gray-50 rounded-lg px-3 py-2">{referralLink}</p>
          )}
          <PartnerReferralShareModal
            isOpen={shareModalOpen}
            onClose={() => setShareModalOpen(false)}
            cupomCode={partnerCode.code}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-amber-600" />
            <p className="text-sm font-bold text-gray-900">Crie seu cupom para começar</p>
          </div>
          <input
            type="text"
            value={draftCode}
            onChange={(e) => onDraftChange?.(e.target.value)}
            placeholder="BITELO"
            maxLength={20}
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-xl border-2 border-gray-300 px-4 py-3 text-lg font-bold uppercase tracking-wider text-gray-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none"
          />
          <button
            type="button"
            disabled={isSaving || draftCode.length < 3}
            onClick={onSaveCode}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-extrabold text-sm disabled:opacity-50"
          >
            {isSaving ? 'Salvando...' : 'Salvar meu cupom'}
          </button>
        </div>
      )}

      {isLoadingSummary ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((key) => (
            <div key={key} className="rounded-xl border border-gray-200 bg-white/70 h-24 animate-pulse" />
          ))}
        </div>
      ) : showMetrics ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-emerald-200 bg-white p-4">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wide text-emerald-800">
              Parceiros ativos
            </p>
            <p className="mt-2 text-2xl sm:text-3xl font-black text-gray-900">
              {summary.freeActiveProgress}/{summary.freeActiveTarget}
            </p>
            <p className="mt-1 text-xs text-gray-600">{summary.activeCount} ativos no total</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-white p-4">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wide text-amber-800">
              Mensalidade grátis
            </p>
            <p className="mt-2 text-sm sm:text-base font-extrabold text-gray-900 leading-snug">
              {summary.freeActiveProgress >= summary.freeActiveTarget ? '✅ Ativa' : '⏳ Em progresso'}
            </p>
            <p className="mt-1 text-xs text-gray-600 line-clamp-2">{summary.freeMonthMessage}</p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-white p-4">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wide text-blue-800">
              Lucro mensal estimado
            </p>
            <p className="mt-2 text-2xl sm:text-3xl font-black text-gray-900">
              {formatPartnerReferralMoney(summary.estimatedMonthlyProfitBrl)}
            </p>
          </div>
          <div className="rounded-xl border border-violet-200 bg-white p-4">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wide text-violet-800 flex items-center gap-1">
              <Wallet className="w-3 h-3" />
              Saldo disponível
            </p>
            <p className="mt-2 text-2xl sm:text-3xl font-black text-gray-900">
              {formatPartnerReferralMoney(summary.estimatedMonthlyProfitBrl)}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
};
