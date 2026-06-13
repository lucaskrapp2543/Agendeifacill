import { Banknote, Users } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildPartnerReferralMotivationMessage,
  fetchPartnerReferralsDashboard,
  formatPartnerReferralMoney,
  type PartnerReferredEstablishmentRow,
  type PartnerReferralsDashboardSummary,
} from '../lib/partnerReferralDashboard';
import {
  fetchPartnerWithdrawalRequests,
  formatWithdrawalAmountFromCents,
  getPartnerWithdrawalDayMessage,
  hasBlockingWithdrawalThisMonth,
  isPartnerWithdrawalDayAvailable,
  requestPartnerWithdrawal,
  type PartnerWithdrawalRequestRow,
} from '../lib/partnerReferralWithdrawal';
import {
  fetchPartnerEstablishmentPaymentDueDate,
  fetchPartnerFreeMonthlyHistory,
  type PartnerFreeMonthlyHistoryRow,
} from '../lib/partnerReferralFreeMonthly';
import {
  fetchPartnerPayoutSettings,
  type PartnerPayoutSettingsRow,
} from '../lib/partnerReferralPayoutSettings';
import { PartnerReferralProgramNewsSection } from './PartnerReferralProgramNewsSection';
import { PartnerPayoutSettingsSection } from './PartnerPayoutSettingsSection';
import { PartnerFreeMonthlySection } from './PartnerFreeMonthlySection';
import { PartnerReferralMilestonesSection } from './PartnerReferralMilestonesSection';
import { PartnerReferralHeroSection } from './PartnerReferralHeroSection';
import { PartnerReferralHowItWorksSection } from './PartnerReferralHowItWorksSection';
import { PartnerReferralEarningsSection } from './PartnerReferralEarningsSection';
import type { PartnerReferralCodeRow } from '../lib/partnerReferral';

type PartnerReferralsSectionProps = {
  establishmentId?: string | null;
  partnerCode?: PartnerReferralCodeRow | null;
  cupomLoading?: boolean;
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

const formatEntryDate = (value?: string | null) => {
  const raw = String(value || '').trim();
  if (!raw) return '—';
  const dt = new Date(raw);
  if (!Number.isFinite(dt.getTime())) return '—';
  return dt.toLocaleDateString('pt-BR');
};

const formatDueDate = (value?: string | null) => {
  const raw = String(value || '').trim();
  if (!raw) return '—';
  const onlyDate = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (onlyDate) return `${onlyDate[3]}/${onlyDate[2]}/${onlyDate[1]}`;
  const dt = new Date(raw);
  if (!Number.isFinite(dt.getTime())) return '—';
  return dt.toLocaleDateString('pt-BR');
};

const StatusBadge: React.FC<{ row: PartnerReferredEstablishmentRow }> = ({ row }) => {
  if (row.isActiveForCommission) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-400">
        🟢 {row.displayStatusLabel}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-400">
      🔴 {row.displayStatusLabel}
    </span>
  );
};

export const PartnerReferralsSection: React.FC<PartnerReferralsSectionProps> = ({
  establishmentId,
  partnerCode = null,
  cupomLoading = false,
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
  const [items, setItems] = useState<PartnerReferredEstablishmentRow[]>([]);
  const [summary, setSummary] = useState<PartnerReferralsDashboardSummary | null>(null);
  const [withdrawals, setWithdrawals] = useState<PartnerWithdrawalRequestRow[]>([]);
  const [freeMonthlyHistory, setFreeMonthlyHistory] = useState<PartnerFreeMonthlyHistoryRow[]>([]);
  const [paymentDueDate, setPaymentDueDate] = useState<string | null>(null);
  const [payoutSettings, setPayoutSettings] = useState<PartnerPayoutSettingsRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRequestingWithdrawal, setIsRequestingWithdrawal] = useState(false);
  const [withdrawalSuccessMessage, setWithdrawalSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadReferrals = useCallback(async () => {
    const id = String(establishmentId || '').trim();
    if (!id) {
      setItems([]);
      setSummary(null);
      setWithdrawals([]);
      setFreeMonthlyHistory([]);
      setPaymentDueDate(null);
      setPayoutSettings(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const [result, withdrawalResult, freeMonthlyResult, dueDate, payoutResult] = await Promise.all([
        fetchPartnerReferralsDashboard(id),
        fetchPartnerWithdrawalRequests(id),
        fetchPartnerFreeMonthlyHistory(id),
        fetchPartnerEstablishmentPaymentDueDate(id),
        fetchPartnerPayoutSettings(id),
      ]);
      setItems(result.items);
      setSummary(result.summary);
      setWithdrawals(withdrawalResult.items);
      setFreeMonthlyHistory(freeMonthlyResult.items);
      setPaymentDueDate(dueDate);
      setPayoutSettings(payoutResult.settings);
      if (!result.ok && result.error) {
        setError(result.error);
      }
    } catch (loadError: any) {
      setItems([]);
      setSummary(null);
      setWithdrawals([]);
      setFreeMonthlyHistory([]);
      setPaymentDueDate(null);
      setPayoutSettings(null);
      setError(loadError?.message || 'Não foi possível carregar seus indicados.');
    } finally {
      setIsLoading(false);
    }
  }, [establishmentId]);

  const availableWithdrawalBrl = summary?.estimatedMonthlyProfitBrl ?? 0;
  const withdrawalDayAvailable = isPartnerWithdrawalDayAvailable();
  const alreadyRequestedThisMonth = useMemo(
    () => hasBlockingWithdrawalThisMonth(withdrawals),
    [withdrawals]
  );
  const canRequestWithdrawal =
    withdrawalDayAvailable && availableWithdrawalBrl > 0 && !alreadyRequestedThisMonth && !isRequestingWithdrawal;

  const motivation = summary ? buildPartnerReferralMotivationMessage(summary) : null;

  const handleRequestWithdrawal = async () => {
    const id = String(establishmentId || '').trim();
    if (!id || !canRequestWithdrawal) return;

    setIsRequestingWithdrawal(true);
    try {
      const result = await requestPartnerWithdrawal(id);
      if (!result.ok) {
        setError(result.message || result.error || 'Não foi possível solicitar saque.');
        return;
      }
      setWithdrawalSuccessMessage(
        result.message ||
          'Solicitação enviada com sucesso. O Agendei Fácil irá analisar e realizar o pagamento via Pix.'
      );
      const refreshed = await fetchPartnerWithdrawalRequests(id);
      setWithdrawals(refreshed.items);
    } finally {
      setIsRequestingWithdrawal(false);
    }
  };

  useEffect(() => {
    void loadReferrals();
  }, [loadReferrals]);

  return (
    <>
      {/* 1. Hero */}
      <PartnerReferralHeroSection
        partnerCode={partnerCode}
        isLoadingCupom={cupomLoading}
        cupomError={cupomError}
        draftCode={draftCode}
        isSaving={isSaving}
        referralLink={referralLink}
        onDraftChange={onDraftChange}
        onSaveCode={onSaveCode}
        onCopyCupom={onCopyCupom}
        onCopyLink={onCopyLink}
        onShareWhatsApp={onShareWhatsApp}
      />

      {/* 2. Meus Indicados — logo após o hero */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-violet-600 flex items-center justify-center shrink-0 shadow-md">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl sm:text-2xl font-extrabold text-white">👥 Meus Indicados</h2>
            {isLoading ? (
              <p className="mt-1 text-sm text-white/50">Carregando...</p>
            ) : motivation ? (
              <div className="mt-3 space-y-1">
                <p className="text-xl sm:text-2xl font-black text-amber-300 leading-snug">{motivation.headline}</p>
                {motivation.subline && (
                  <p className="text-sm text-white/65 leading-relaxed">{motivation.subline}</p>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-xl border border-white/10 bg-[#0f172a]/60 p-6 text-center text-white/50">
            Carregando indicados...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-100">{error}</div>
        ) : (
          <>
            {summary && (
              <div className="rounded-xl border border-violet-400/30 bg-violet-500/10 p-4 sm:p-5 space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center shrink-0">
                      <Banknote className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="text-base font-extrabold text-white">Saque via Pix</h4>
                      <p className="text-sm text-white/80 mt-1">
                        Disponível: <strong className="text-white">{formatPartnerReferralMoney(availableWithdrawalBrl)}</strong>
                      </p>
                      <p className="text-xs text-white/50 mt-1">{getPartnerWithdrawalDayMessage()}</p>
                      {alreadyRequestedThisMonth && (
                        <p className="text-xs text-amber-300 mt-1 font-semibold">
                          Você já possui uma solicitação de saque neste mês.
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleRequestWithdrawal()}
                    disabled={!canRequestWithdrawal}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-md hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40"
                  >
                    {isRequestingWithdrawal ? 'Enviando...' : '💸 Solicitar saque'}
                  </button>
                </div>
                {withdrawals.length > 0 && (
                  <div className="text-xs text-white/50">
                    Última solicitação: {formatWithdrawalAmountFromCents(withdrawals[0].amountCents)} —{' '}
                    {withdrawals[0].status === 'pending'
                      ? 'Pendente'
                      : withdrawals[0].status === 'paid'
                        ? 'Pago'
                        : 'Cancelado'}
                  </div>
                )}
              </div>
            )}

            {items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/20 bg-[#0f172a]/40 p-8 text-center space-y-2">
                <p className="text-lg font-bold text-white">Você ainda não possui indicações.</p>
                <p className="text-sm text-white/60">Compartilhe seu cupom para começar a ganhar.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="min-w-full text-sm">
                  <thead className="bg-[#0f172a]/80 text-left text-xs uppercase tracking-wide text-white/50">
                    <tr>
                      <th className="px-4 py-3 font-bold">Barbearia</th>
                      <th className="px-4 py-3 font-bold">Entrada</th>
                      <th className="px-4 py-3 font-bold">Plano</th>
                      <th className="px-4 py-3 font-bold">Status</th>
                      <th className="px-4 py-3 font-bold">Vencimento</th>
                      <th className="px-4 py-3 font-bold">Último agendamento</th>
                      <th className="px-4 py-3 font-bold">Geração mensal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {items.map((row) => (
                      <tr key={row.referralId || row.referredEstablishmentId} className="bg-[#0f172a]/40">
                        <td className="px-4 py-3 font-semibold text-white">{row.establishmentName}</td>
                        <td className="px-4 py-3 text-white/70">{formatEntryDate(row.linkedAt)}</td>
                        <td className="px-4 py-3 text-white/70">{row.selectedPlan}</td>
                        <td className="px-4 py-3">
                          <StatusBadge row={row} />
                        </td>
                        <td className="px-4 py-3 text-white/70">{formatDueDate(row.paymentDueDate)}</td>
                        <td className="px-4 py-3 text-white/70">{row.lastAppointmentLabel}</td>
                        <td className="px-4 py-3">
                          {row.isActiveForCommission ? (
                            <span className="font-bold text-emerald-400">{row.monthlyGenerationLabel}</span>
                          ) : (
                            <span className="font-semibold text-red-400">🔴 Pausado</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      {/* 3. Como funciona */}
      <PartnerReferralHowItWorksSection variant="compact" />

      {/* 4. Simulações */}
      <PartnerReferralEarningsSection />

      {/* 5. Pix para saque */}
      <PartnerPayoutSettingsSection
        establishmentId={establishmentId}
        initialSettings={payoutSettings}
        isLoading={isLoading}
        onSaved={(settings) => setPayoutSettings(settings)}
        variant="ganhe-dinheiro"
      />

      {/* 6. Mensalidade grátis — compacto, sem repetir hero */}
      <PartnerFreeMonthlySection
        summary={summary}
        paymentDueDate={paymentDueDate}
        history={freeMonthlyHistory}
        isLoading={isLoading}
        variant="compact"
      />

      {/* Metas e premiações */}
      <PartnerReferralMilestonesSection activeCount={summary?.activeCount ?? 0} isLoading={isLoading} />

      {/* Novidades — no final */}
      <PartnerReferralProgramNewsSection establishmentId={establishmentId} variant="ganhe-dinheiro" />

      {withdrawalSuccessMessage && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h4 className="text-xl font-extrabold text-gray-900">Solicitação enviada</h4>
            <p className="text-sm text-gray-700 leading-relaxed">{withdrawalSuccessMessage}</p>
            <button
              type="button"
              onClick={() => setWithdrawalSuccessMessage(null)}
              className="w-full rounded-xl bg-gray-900 px-4 py-3 text-sm font-bold text-white hover:bg-gray-800"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
};
