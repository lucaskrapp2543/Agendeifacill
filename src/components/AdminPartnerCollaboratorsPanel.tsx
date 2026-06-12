import { Eye, RefreshCw, Search, Users, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  fetchAdminPartnerCollaborators,
  formatAdminPartnerDate,
  formatAdminPartnerDueDate,
  formatPartnerReferralMoney,
  type AdminPartnerCollaboratorRow,
} from '../lib/partnerReferralAdmin';
import {
  adminUpsertPartnerFreeMonthly,
  buildPartnerFreeMonthlyViewFromSummary,
  fetchPartnerFreeMonthlyHistory,
  formatPartnerFreeMonthlyReferenceMonth,
  getPartnerFreeMonthlyStatusLabel,
  type PartnerFreeMonthlyHistoryRow,
} from '../lib/partnerReferralFreeMonthly';
import {
  fetchPartnerPayoutSettings,
  formatPartnerPixKeyForDisplay,
  getPartnerPixKeyTypeLabel,
  type PartnerPayoutSettingsRow,
} from '../lib/partnerReferralPayoutSettings';
import {
  adminUpdatePartnerWithdrawalRequest,
  fetchPartnerWithdrawalRequests,
  formatWithdrawalAmountFromCents,
  getWithdrawalStatusLabel,
  type PartnerWithdrawalRequestRow,
} from '../lib/partnerReferralWithdrawal';

interface AdminPartnerCollaboratorsPanelProps {
  onClose: () => void;
}

export const AdminPartnerCollaboratorsPanel: React.FC<AdminPartnerCollaboratorsPanelProps> = ({ onClose }) => {
  const [partners, setPartners] = useState<AdminPartnerCollaboratorRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPartner, setSelectedPartner] = useState<AdminPartnerCollaboratorRow | null>(null);
  const [partnerWithdrawals, setPartnerWithdrawals] = useState<PartnerWithdrawalRequestRow[]>([]);
  const [isLoadingWithdrawals, setIsLoadingWithdrawals] = useState(false);
  const [updatingWithdrawalId, setUpdatingWithdrawalId] = useState<string | null>(null);
  const [partnerFreeMonthlyHistory, setPartnerFreeMonthlyHistory] = useState<PartnerFreeMonthlyHistoryRow[]>([]);
  const [isLoadingFreeMonthly, setIsLoadingFreeMonthly] = useState(false);
  const [isUpdatingFreeMonthly, setIsUpdatingFreeMonthly] = useState(false);
  const [partnerPayoutSettings, setPartnerPayoutSettings] = useState<PartnerPayoutSettingsRow | null>(null);
  const [isLoadingPayoutSettings, setIsLoadingPayoutSettings] = useState(false);

  const loadPartners = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await fetchAdminPartnerCollaborators();
      if (!result.ok && result.error) {
        toast.error(result.error);
      }
      setPartners(result.partners);
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao carregar colaboradores.');
      setPartners([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPartners();
  }, [loadPartners]);

  const loadPartnerWithdrawals = useCallback(async (partnerEstablishmentId: string) => {
    setIsLoadingWithdrawals(true);
    try {
      const result = await fetchPartnerWithdrawalRequests(partnerEstablishmentId);
      if (!result.ok && result.error) {
        toast.error(result.error);
      }
      setPartnerWithdrawals(result.items);
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao carregar saques.');
      setPartnerWithdrawals([]);
    } finally {
      setIsLoadingWithdrawals(false);
    }
  }, []);

  const loadPartnerFreeMonthly = useCallback(async (partnerEstablishmentId: string) => {
    setIsLoadingFreeMonthly(true);
    try {
      const result = await fetchPartnerFreeMonthlyHistory(partnerEstablishmentId);
      if (!result.ok && result.error) toast.error(result.error);
      setPartnerFreeMonthlyHistory(result.items);
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao carregar mensalidade grátis.');
      setPartnerFreeMonthlyHistory([]);
    } finally {
      setIsLoadingFreeMonthly(false);
    }
  }, []);

  const loadPartnerPayoutSettings = useCallback(async (partnerEstablishmentId: string) => {
    setIsLoadingPayoutSettings(true);
    try {
      const result = await fetchPartnerPayoutSettings(partnerEstablishmentId);
      if (!result.ok && result.error) toast.error(result.error);
      setPartnerPayoutSettings(result.settings);
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao carregar dados Pix.');
      setPartnerPayoutSettings(null);
    } finally {
      setIsLoadingPayoutSettings(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedPartner?.partnerEstablishmentId) {
      setPartnerWithdrawals([]);
      setPartnerFreeMonthlyHistory([]);
      setPartnerPayoutSettings(null);
      return;
    }
    void loadPartnerWithdrawals(selectedPartner.partnerEstablishmentId);
    void loadPartnerFreeMonthly(selectedPartner.partnerEstablishmentId);
    void loadPartnerPayoutSettings(selectedPartner.partnerEstablishmentId);
  }, [
    selectedPartner?.partnerEstablishmentId,
    loadPartnerWithdrawals,
    loadPartnerFreeMonthly,
    loadPartnerPayoutSettings,
  ]);

  const selectedFreeMonthlyView = useMemo(() => {
    if (!selectedPartner) return null;
    return buildPartnerFreeMonthlyViewFromSummary(selectedPartner.summary, null, partnerFreeMonthlyHistory);
  }, [selectedPartner, partnerFreeMonthlyHistory]);

  const handleAdminFreeMonthlyAction = async (status: 'applied' | 'lost') => {
    if (!selectedPartner?.partnerEstablishmentId) return;
    const message =
      status === 'applied'
        ? 'Marcar mensalidade como GRÁTIS neste mês?\n\nIsso só registra no histórico — NÃO altera cobrança automática.'
        : 'Registrar PERDA do benefício de mensalidade grátis neste mês?';
    if (!window.confirm(message)) return;

    setIsUpdatingFreeMonthly(true);
    try {
      const result = await adminUpsertPartnerFreeMonthly({
        partnerEstablishmentId: selectedPartner.partnerEstablishmentId,
        status,
      });
      if (!result.ok) {
        toast.error(result.message || result.error || 'Não foi possível registrar.');
        return;
      }
      toast.success(result.message || 'Registrado com sucesso.');
      await loadPartnerFreeMonthly(selectedPartner.partnerEstablishmentId);
    } finally {
      setIsUpdatingFreeMonthly(false);
    }
  };

  const pendingWithdrawals = useMemo(
    () => partnerWithdrawals.filter((request) => request.status === 'pending'),
    [partnerWithdrawals]
  );

  const handleAdminWithdrawalAction = async (requestId: string, action: 'paid' | 'cancel') => {
    if (!selectedPartner?.partnerEstablishmentId) return;
    const confirmMessage =
      action === 'paid'
        ? 'Marcar esta solicitação como paga via Pix?'
        : 'Cancelar esta solicitação de saque?';
    if (!window.confirm(confirmMessage)) return;

    setUpdatingWithdrawalId(requestId);
    try {
      const result = await adminUpdatePartnerWithdrawalRequest({ requestId, action });
      if (!result.ok) {
        toast.error(result.message || result.error || 'Não foi possível atualizar.');
        return;
      }
      toast.success(result.message || 'Atualizado com sucesso.');
      await loadPartnerWithdrawals(selectedPartner.partnerEstablishmentId);
    } finally {
      setUpdatingWithdrawalId(null);
    }
  };

  const filteredPartners = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return partners;
    return partners.filter((partner) => {
      return (
        partner.partnerName.toLowerCase().includes(term) ||
        partner.partnerCode.toLowerCase().includes(term) ||
        String(partner.couponCode || '').toLowerCase().includes(term)
      );
    });
  }, [partners, searchTerm]);

  const totals = useMemo(() => {
    return partners.reduce(
      (acc, partner) => {
        acc.totalPartners += 1;
        acc.totalReferrals += partner.totalReferrals;
        acc.totalActive += partner.summary.activeCount;
        acc.totalEstimatedProfit += partner.summary.estimatedMonthlyProfitBrl;
        if (partner.summary.activeCount >= partner.summary.freeActiveTarget) {
          acc.freeMonthlyEligible += 1;
        } else if (partner.summary.activeCount > 0) {
          acc.freeMonthlyNear += 1;
        }
        return acc;
      },
      { totalPartners: 0, totalReferrals: 0, totalActive: 0, totalEstimatedProfit: 0, freeMonthlyEligible: 0, freeMonthlyNear: 0 }
    );
  }, [partners]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-2xl bg-white text-gray-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 p-5">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">💰 Meus Colaboradores</h2>
            <p className="text-sm text-gray-600">
              Parceiros, mensalidade grátis manual, indicações e saques.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadPartners()}
              disabled={isLoading}
              className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              title="Atualizar"
            >
              <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="grid gap-3 border-b border-gray-200 p-5 sm:grid-cols-5">
          <div className="rounded-xl bg-amber-50 p-4">
            <p className="text-xs font-bold uppercase text-amber-800">Colaboradores</p>
            <p className="mt-1 text-2xl font-black text-gray-900">{totals.totalPartners}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 p-4">
            <p className="text-xs font-bold uppercase text-emerald-800">Grátis elegível (3+)</p>
            <p className="mt-1 text-2xl font-black text-gray-900">{totals.freeMonthlyEligible}</p>
          </div>
          <div className="rounded-xl bg-yellow-50 p-4">
            <p className="text-xs font-bold uppercase text-yellow-800">Perto (1–2/3)</p>
            <p className="mt-1 text-2xl font-black text-gray-900">{totals.freeMonthlyNear}</p>
          </div>
          <div className="rounded-xl bg-blue-50 p-4">
            <p className="text-xs font-bold uppercase text-blue-800">Total indicados</p>
            <p className="mt-1 text-2xl font-black text-gray-900">{totals.totalReferrals}</p>
          </div>
          <div className="rounded-xl bg-indigo-50 p-4">
            <p className="text-xs font-bold uppercase text-indigo-800">Lucro est./mês</p>
            <p className="mt-1 text-2xl font-black text-gray-900">
              {formatPartnerReferralMoney(totals.totalEstimatedProfit)}
            </p>
          </div>
        </div>

        <div className="border-b border-gray-200 p-5">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar barbearia ou cupom..."
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm text-gray-900"
            />
          </div>
        </div>

        <div className="max-h-[52vh] overflow-y-auto p-5">
          {isLoading ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center text-gray-500">
              Carregando colaboradores...
            </div>
          ) : filteredPartners.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center space-y-2">
              <Users className="mx-auto h-10 w-10 text-gray-400" />
              <p className="text-lg font-bold text-gray-900">Nenhum colaborador com cupom ou indicações ainda.</p>
              <p className="text-sm text-gray-600">Quando parceiros criarem cupom e indicarem clientes, aparecerão aqui.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPartners.map((partner) => {
                const listFreeMonthly = buildPartnerFreeMonthlyViewFromSummary(partner.summary);
                const badgeToneClass =
                  listFreeMonthly.adminListBadgeTone === 'active'
                    ? 'bg-emerald-100 text-emerald-800'
                    : listFreeMonthly.adminListBadgeTone === 'progress'
                      ? 'bg-amber-100 text-amber-800'
                      : listFreeMonthly.adminListBadgeTone === 'lost'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-700';

                return (
                <div
                  key={partner.partnerEstablishmentId}
                  className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-amber-200"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-extrabold text-gray-900 truncate">{partner.partnerName}</p>
                      <p className="text-sm text-gray-500">
                        Código {partner.partnerCode || '—'}
                        {partner.couponCode ? (
                          <>
                            {' '}
                            · Cupom <strong className="text-gray-800">{partner.couponCode}</strong>
                          </>
                        ) : null}
                      </p>
                      <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${badgeToneClass}`}>
                        {listFreeMonthly.adminListBadge}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 text-sm">
                      <div>
                        <p className="text-xs text-gray-500">Indicados</p>
                        <p className="font-bold text-gray-900">{partner.totalReferrals}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Ativos</p>
                        <p className="font-bold text-emerald-700">{partner.summary.activeCount}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Mensalidade</p>
                        <p className="font-bold text-gray-900">
                          {partner.summary.freeActiveProgress}/{partner.summary.freeActiveTarget}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Lucro est.</p>
                        <p className="font-bold text-indigo-700">
                          {formatPartnerReferralMoney(partner.summary.estimatedMonthlyProfitBrl)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Status</p>
                        <p className="font-semibold text-gray-800">{partner.statusLabel}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedPartner(partner)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-bold text-white hover:bg-black"
                    >
                      <Eye className="h-4 w-4" />
                      Ver detalhes
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selectedPartner && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white text-gray-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 p-5">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{selectedPartner.partnerName}</h3>
                <p className="text-sm text-gray-600">Detalhes do parceiro e indicados</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPartner(null)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[78vh] overflow-y-auto p-5 space-y-6">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-gray-200 p-4">
                  <p className="text-xs font-bold uppercase text-gray-500">Cupom</p>
                  <p className="mt-1 text-xl font-black text-gray-900">{selectedPartner.couponCode || '—'}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Criado em {formatAdminPartnerDate(selectedPartner.couponCreatedAt)}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 p-4">
                  <p className="text-xs font-bold uppercase text-gray-500">Total indicados</p>
                  <p className="mt-1 text-xl font-black text-gray-900">{selectedPartner.totalReferrals}</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs font-bold uppercase text-emerald-800">Ativos</p>
                  <p className="mt-1 text-xl font-black text-gray-900">{selectedPartner.statusCounts.ativos}</p>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="text-xs font-bold uppercase text-red-800">Inadimplentes</p>
                  <p className="mt-1 text-xl font-black text-gray-900">{selectedPartner.statusCounts.inadimplente}</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-gray-200 p-4 text-sm text-gray-900">
                  <p className="font-bold text-gray-900">Cancelados</p>
                  <p className="mt-1 text-2xl font-black text-gray-900">{selectedPartner.statusCounts.cancelados}</p>
                </div>
                <div className="rounded-xl border border-gray-200 p-4 text-sm text-gray-900">
                  <p className="font-bold text-gray-900">Bloqueados</p>
                  <p className="mt-1 text-2xl font-black text-gray-900">{selectedPartner.statusCounts.bloqueados}</p>
                </div>
                <div className="rounded-xl border border-gray-200 p-4 text-sm text-gray-900">
                  <p className="font-bold text-gray-900">Teste</p>
                  <p className="mt-1 text-2xl font-black text-gray-900">{selectedPartner.statusCounts.teste}</p>
                </div>
              </div>

              <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-5 space-y-3">
                <h4 className="text-lg font-extrabold text-gray-900">💸 Dados Pix</h4>
                {isLoadingPayoutSettings ? (
                  <p className="text-sm text-gray-600">Carregando...</p>
                ) : partnerPayoutSettings ? (
                  <div className="rounded-xl border border-teal-100 bg-white p-4 text-sm text-gray-800 space-y-1">
                    <p>
                      <strong>Tipo:</strong> {getPartnerPixKeyTypeLabel(partnerPayoutSettings.pixKeyType)}
                    </p>
                    <p>
                      <strong>Chave:</strong>{' '}
                      {formatPartnerPixKeyForDisplay(
                        partnerPayoutSettings.pixKeyType,
                        partnerPayoutSettings.pixKey
                      )}
                    </p>
                    <p>
                      <strong>Nome:</strong> {partnerPayoutSettings.receiverName || '—'}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">Parceiro ainda não cadastrou chave Pix.</p>
                )}
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-5 space-y-4">
                <h4 className="text-lg font-extrabold text-gray-900">Mensalidade grátis (controle manual)</h4>
                {isLoadingFreeMonthly ? (
                  <p className="text-sm text-gray-600">Carregando histórico...</p>
                ) : selectedFreeMonthlyView ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-3 text-sm text-gray-800">
                      <p className="text-gray-800">
                        <strong className="text-gray-900">Elegibilidade:</strong> {selectedFreeMonthlyView.progressLabel} ativos
                      </p>
                      <p className="text-gray-800">
                        <strong className="text-gray-900">Status:</strong> {selectedFreeMonthlyView.statusLabel}
                      </p>
                      <p className="text-gray-800">
                        <strong className="text-gray-900">Inadimplentes/cancelados:</strong>{' '}
                        {selectedPartner.statusCounts.inadimplente + selectedPartner.statusCounts.cancelados}{' '}
                        indicado(s) pausado(s)
                      </p>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{selectedFreeMonthlyView.protectionMessage}</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={
                          isUpdatingFreeMonthly ||
                          selectedPartner.summary.activeCount < selectedPartner.summary.freeActiveTarget ||
                          selectedFreeMonthlyView.appliedThisMonth
                        }
                        onClick={() => void handleAdminFreeMonthlyAction('applied')}
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Marcar mensalidade como grátis neste mês
                      </button>
                      <button
                        type="button"
                        disabled={isUpdatingFreeMonthly || !selectedFreeMonthlyView.lostBenefitHint}
                        onClick={() => void handleAdminFreeMonthlyAction('lost')}
                        className="rounded-lg border border-red-300 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Registrar perda do benefício
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">
                      Registro administrativo apenas — não altera Mercado Pago, billing ou vencimentos automaticamente.
                    </p>
                    {partnerFreeMonthlyHistory.length > 0 ? (
                      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                        <table className="min-w-full text-sm">
                          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                            <tr>
                              <th className="px-3 py-2 font-bold">Mês</th>
                              <th className="px-3 py-2 font-bold">Ativos no registro</th>
                              <th className="px-3 py-2 font-bold">Status</th>
                              <th className="px-3 py-2 font-bold">Aplicado em</th>
                              <th className="px-3 py-2 font-bold">Obs.</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 text-gray-800">
                            {partnerFreeMonthlyHistory.map((row) => (
                              <tr key={row.id}>
                                <td className="px-3 py-2 text-gray-800">{formatPartnerFreeMonthlyReferenceMonth(row.referenceMonth)}</td>
                                <td className="px-3 py-2 font-bold text-gray-900">{row.activeReferralsCount}</td>
                                <td className="px-3 py-2 text-gray-800">{getPartnerFreeMonthlyStatusLabel(row.status)}</td>
                                <td className="px-3 py-2 text-gray-800">
                                  {row.appliedAt ? formatAdminPartnerDate(row.appliedAt) : '—'}
                                </td>
                                <td className="px-3 py-2 text-gray-800">{row.notes || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-600">Nenhum registro de mensalidade grátis ainda.</p>
                    )}
                  </>
                ) : null}
              </div>

              <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-5 space-y-3">
                <h4 className="text-lg font-extrabold text-gray-900">Financeiro estimado</h4>
                <div className="grid gap-2 sm:grid-cols-2 text-sm text-gray-800">
                  <p className="text-gray-800">
                    <strong className="text-gray-900">Mensalidade grátis ativa:</strong>{' '}
                    {selectedPartner.summary.activeCount >= selectedPartner.summary.freeActiveTarget ? 'Sim' : 'Não'}
                  </p>
                  <p className="text-gray-800">
                    <strong className="text-gray-900">Clientes para mensalidade:</strong>{' '}
                    {selectedPartner.summary.freeActiveProgress}/{selectedPartner.summary.freeActiveTarget}
                  </p>
                  <p className="text-gray-800">
                    <strong className="text-gray-900">Lucro mensal estimado:</strong>{' '}
                    {formatPartnerReferralMoney(selectedPartner.summary.estimatedMonthlyProfitBrl)}
                  </p>
                  <p className="text-gray-800">
                    <strong className="text-gray-900">Saldo estimado futuro:</strong>{' '}
                    {formatPartnerReferralMoney(selectedPartner.summary.estimatedMonthlyProfitBrl)}/mês recorrente
                    (enquanto indicados permanecerem ativos)
                  </p>
                </div>
                <p className="text-xs text-gray-600">
                  Estimativa de lucro — saques manuais via Pix pelo admin.
                </p>
              </div>

              <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-5 space-y-4">
                <h4 className="text-lg font-extrabold text-gray-900">Solicitações de saque</h4>
                {isLoadingWithdrawals ? (
                  <p className="text-sm text-gray-600">Carregando saques...</p>
                ) : partnerWithdrawals.length === 0 ? (
                  <p className="text-sm text-gray-600">Nenhuma solicitação de saque registrada.</p>
                ) : (
                  <div className="space-y-4">
                    {pendingWithdrawals.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-bold text-amber-900">Pendentes</p>
                        {pendingWithdrawals.map((request) => (
                          <div
                            key={request.id}
                            className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="text-sm">
                              <p className="font-bold text-gray-900">
                                {formatWithdrawalAmountFromCents(request.amountCents)}
                              </p>
                              <p className="text-gray-600">
                                Solicitado em {formatAdminPartnerDate(request.requestedAt)}
                              </p>
                              <p className="text-gray-600">Status: {getWithdrawalStatusLabel(request.status)}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={updatingWithdrawalId === request.id}
                                onClick={() => void handleAdminWithdrawalAction(request.id, 'paid')}
                                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                              >
                                Marcar como pago
                              </button>
                              <button
                                type="button"
                                disabled={updatingWithdrawalId === request.id}
                                onClick={() => void handleAdminWithdrawalAction(request.id, 'cancel')}
                                className="rounded-lg border border-red-300 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                              >
                                Cancelar solicitação
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                          <tr>
                            <th className="px-3 py-2 font-bold">Valor</th>
                            <th className="px-3 py-2 font-bold">Solicitado em</th>
                            <th className="px-3 py-2 font-bold">Status</th>
                            <th className="px-3 py-2 font-bold">Pago em</th>
                            <th className="px-3 py-2 font-bold">Observações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-gray-800">
                          {partnerWithdrawals.map((request) => (
                            <tr key={request.id}>
                              <td className="px-3 py-2 font-bold text-gray-900">
                                {formatWithdrawalAmountFromCents(request.amountCents)}
                              </td>
                              <td className="px-3 py-2 text-gray-800">{formatAdminPartnerDate(request.requestedAt)}</td>
                              <td className="px-3 py-2 text-gray-800">{getWithdrawalStatusLabel(request.status)}</td>
                              <td className="px-3 py-2 text-gray-800">
                                {request.paidAt ? formatAdminPartnerDate(request.paidAt) : '—'}
                              </td>
                              <td className="px-3 py-2 text-gray-800">{request.notes || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-lg font-extrabold text-gray-900 mb-3">Lista de indicados</h4>
                {selectedPartner.referrals.length === 0 ? (
                  <p className="text-sm text-gray-600">Nenhum indicado vinculado ainda.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                        <tr>
                          <th className="px-3 py-2 font-bold">Barbearia</th>
                          <th className="px-3 py-2 font-bold">Plano</th>
                          <th className="px-3 py-2 font-bold">Entrada</th>
                          <th className="px-3 py-2 font-bold">Vencimento</th>
                          <th className="px-3 py-2 font-bold">Pagamento</th>
                          <th className="px-3 py-2 font-bold">Último agend.</th>
                          <th className="px-3 py-2 font-bold">Valor/mês</th>
                          <th className="px-3 py-2 font-bold">Conta como</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white text-gray-800">
                        {selectedPartner.referrals.map((row) => (
                          <tr key={row.referralId || row.referredEstablishmentId}>
                            <td className="px-3 py-2 font-semibold text-gray-900">{row.establishmentName}</td>
                            <td className="px-3 py-2 text-gray-800">{row.selectedPlan}</td>
                            <td className="px-3 py-2 text-gray-800">{formatAdminPartnerDate(row.linkedAt)}</td>
                            <td className="px-3 py-2 text-gray-800">{formatAdminPartnerDueDate(row.paymentDueDate)}</td>
                            <td className="px-3 py-2">
                              {row.isActiveForCommission ? (
                                <span className="text-emerald-700 font-semibold">🟢 {row.displayStatusLabel}</span>
                              ) : (
                                <span className="text-red-700 font-semibold">🔴 {row.displayStatusLabel}</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-gray-800">{row.lastAppointmentLabel}</td>
                            <td className="px-3 py-2 font-bold text-gray-900">{row.monthlyValueLabel}</td>
                            <td className="px-3 py-2 text-gray-800">{row.commissionBucketLabel}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
