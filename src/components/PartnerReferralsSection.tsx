import { Banknote, Users } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
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
import { PartnerReferralSummarySection } from './PartnerReferralSummarySection';
import { PartnerReferralHowItWorksSection } from './PartnerReferralHowItWorksSection';
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
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
        🟢 {row.displayStatusLabel}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-700">
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
    <div className="space-y-6">
      <PartnerReferralSummarySection
        partnerCode={partnerCode}
        summary={summary}
        isLoadingCupom={cupomLoading}
        isLoadingSummary={isLoading}
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

      <PartnerReferralHowItWorksSection
        hasCupom={Boolean(partnerCode?.code)}
        cupomCode={partnerCode?.code}
        onShareWhatsApp={onShareWhatsApp}
        onCopyCupom={onCopyCupom}
      />

      <PartnerReferralProgramNewsSection establishmentId={establishmentId} />

      <PartnerReferralMilestonesSection activeCount={summary?.activeCount ?? 0} isLoading={isLoading} />

      <PartnerPayoutSettingsSection
        establishmentId={establishmentId}
        initialSettings={payoutSettings}
        isLoading={isLoading}
        onSaved={(settings) => setPayoutSettings(settings)}
      />

      <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-8 shadow-lg space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center">
          <Users className="w-5 h-5 text-amber-300" />
        </div>
        <div>
          <h3 className="text-xl sm:text-2xl font-extrabold text-gray-900">Meus indicados</h3>
          <p className="text-sm text-gray-600">Estabelecimentos que entraram usando o seu cupom.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-6 text-center text-gray-500">
          Carregando indicados...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
      ) : (
        <>
          {summary && (
            <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-5 space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center shrink-0">
                    <Banknote className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-lg font-extrabold text-gray-900">Saque manual via Pix</h4>
                    <p className="text-sm text-gray-700 mt-1">
                      Valor disponível:{' '}
                      <strong>{formatPartnerReferralMoney(availableWithdrawalBrl)}</strong>
                    </p>
                    <p className="text-xs text-gray-600 mt-1">{getPartnerWithdrawalDayMessage()}</p>
                    {alreadyRequestedThisMonth && (
                      <p className="text-xs text-amber-800 mt-1 font-semibold">
                        Você já possui uma solicitação de saque neste mês.
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleRequestWithdrawal()}
                  disabled={!canRequestWithdrawal}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-md hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600"
                >
                  {isRequestingWithdrawal ? 'Enviando...' : '💸 Solicitar saque'}
                </button>
              </div>
              {withdrawals.length > 0 && (
                <div className="text-xs text-gray-600">
                  Última solicitação:{' '}
                  {formatWithdrawalAmountFromCents(withdrawals[0].amountCents)} —{' '}
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
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center space-y-2">
              <p className="text-lg font-bold text-gray-900">Você ainda não possui indicações.</p>
              <p className="text-sm text-gray-600">Compartilhe seu cupom para começar.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
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
                <tbody className="divide-y divide-gray-100">
                  {items.map((row) => (
                    <tr key={row.referralId || row.referredEstablishmentId} className="bg-white">
                      <td className="px-4 py-3 font-semibold text-gray-900">{row.establishmentName}</td>
                      <td className="px-4 py-3 text-gray-700">{formatEntryDate(row.linkedAt)}</td>
                      <td className="px-4 py-3 text-gray-700">{row.selectedPlan}</td>
                      <td className="px-4 py-3">
                        <StatusBadge row={row} />
                      </td>
                      <td className="px-4 py-3 text-gray-700">{formatDueDate(row.paymentDueDate)}</td>
                      <td className="px-4 py-3 text-gray-700">{row.lastAppointmentLabel}</td>
                      <td className="px-4 py-3">
                        {row.isActiveForCommission ? (
                          <span className="font-bold text-emerald-700">{row.monthlyGenerationLabel}</span>
                        ) : (
                          <span className="font-semibold text-red-700">🔴 Pausado</span>
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
      </div>

      <PartnerFreeMonthlySection
        summary={summary}
        paymentDueDate={paymentDueDate}
        history={freeMonthlyHistory}
        isLoading={isLoading}
      />
    </div>
  );
};
