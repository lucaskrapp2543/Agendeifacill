import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildExclusiveSubscribersByGroupKey,
  buildProfessionalControlGroups,
  buildProfessionalControlMonthRange,
  createProfessionalControlHelpers,
  loadProfessionalControlSnapshot,
  mergeProfessionalControlSnapshots,
  normalizeProfessionalPercentage,
  resolveProfessionalControlGroupMetrics,
  type ProfessionalControlSnapshot,
} from '../lib/professionalSubscriberControl';
import { normalizeProfessionalNameKey, resolveSubscriberAttendanceProfessionalGroup } from '../lib/subscriberSystem';

export type SubscriberPerformancePeriod = 'current' | 'previous' | 'last3';

type MonthRange = ReturnType<typeof buildProfessionalControlMonthRange>;

export const resolveSubscriberPerformancePeriodRanges = (
  referenceDate: Date,
  period: SubscriberPerformancePeriod
): MonthRange[] => {
  const ref = referenceDate || new Date();
  if (period === 'current') {
    return [buildProfessionalControlMonthRange(ref.getMonth(), ref.getFullYear())];
  }
  if (period === 'previous') {
    const d = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
    return [buildProfessionalControlMonthRange(d.getMonth(), d.getFullYear())];
  }
  const ranges: MonthRange[] = [];
  for (let i = 0; i < 3; i += 1) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    ranges.push(buildProfessionalControlMonthRange(d.getMonth(), d.getFullYear()));
  }
  return ranges;
};

export type UseProfessionalSubscriberControlParams = {
  establishmentId?: string;
  professional: { id: string; name: string; percentage?: number | null };
  referenceDate?: Date;
  period: SubscriberPerformancePeriod;
  enabled?: boolean;
};

export function useProfessionalSubscriberControl({
  establishmentId,
  professional,
  referenceDate,
  period,
  enabled = true,
}: UseProfessionalSubscriberControlParams) {
  const [loading, setLoading] = useState(false);
  const [snapshots, setSnapshots] = useState<ProfessionalControlSnapshot[]>([]);

  const reference = referenceDate || new Date();
  const periodRanges = useMemo(
    () => resolveSubscriberPerformancePeriodRanges(reference, period),
    [reference, period]
  );

  const periodLabel = useMemo(() => {
    if (period === 'last3') {
      const first = periodRanges[periodRanges.length - 1];
      const last = periodRanges[0];
      return `${first?.label || ''} — ${last?.label || ''}`;
    }
    return periodRanges[0]?.label || '';
  }, [period, periodRanges]);

  const primaryRange = periodRanges[0] || buildProfessionalControlMonthRange(reference.getMonth(), reference.getFullYear());

  const groupKey = useMemo(() => {
    const id = String(professional?.id || '').trim();
    return id ? `id:${id}` : `name:${normalizeProfessionalNameKey(professional?.name || '')}`;
  }, [professional?.id, professional?.name]);

  const isOwnerProfessional = normalizeProfessionalPercentage(professional?.percentage) >= 100;

  const loadData = useCallback(async () => {
    const estId = String(establishmentId || '').trim();
    const proId = String(professional?.id || '').trim();
    if (!estId || !proId || !enabled) {
      setSnapshots([]);
      return;
    }

    setLoading(true);
    try {
      const loaded = await Promise.all(
        periodRanges.map((range) =>
          loadProfessionalControlSnapshot({
            establishmentId: estId,
            month: range.month,
            year: range.year,
          })
        )
      );
      setSnapshots(loaded);
    } catch (error) {
      console.warn('⚠️ Falha ao carregar desempenho de assinaturas do profissional:', error);
      setSnapshots([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, establishmentId, periodRanges, professional?.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const merged = useMemo(() => mergeProfessionalControlSnapshots(snapshots), [snapshots]);

  const controlGroups = useMemo(
    () =>
      buildProfessionalControlGroups({
        subscriberAttendances: merged.subscriberAttendances,
        subscriptionSaleCommissions: merged.subscriptionSaleCommissions,
        establishmentProfessionals: merged.establishmentProfessionals,
        deletedProfessionals: merged.deletedProfessionals,
        clientSubscriptions: merged.clientSubscriptions,
        subscriptions: merged.subscriptions,
      }),
    [merged]
  );

  const professionalGroup = useMemo(
    () => controlGroups.find((group) => group.groupKey === groupKey) || null,
    [controlGroups, groupKey]
  );

  const metrics = useMemo(() => {
    if (!professionalGroup) {
      return {
        totalValue: 0,
        attendanceCount: 0,
        averageTicket: 0,
        totalPaid: 0,
        pendingValue: 0,
        uniqueClientsCount: 0,
        saleCommissionCount: 0,
        pointsFromAttendances: 0,
      };
    }

    return resolveProfessionalControlGroupMetrics({
      group: professionalGroup,
      professionalPayments: merged.professionalPayments,
      establishmentProfessionals: merged.establishmentProfessionals,
      deletedProfessionals: merged.deletedProfessionals,
      isOwnerProfessional,
    });
  }, [professionalGroup, merged, isOwnerProfessional]);

  const { getAttendanceEffectiveRepass } = useMemo(
    () => createProfessionalControlHelpers(merged.clientSubscriptions, merged.subscriptions),
    [merged.clientSubscriptions, merged.subscriptions]
  );

  const getProfessionalGroupFromAttendance = useCallback(
    (attendance: any) =>
      resolveSubscriberAttendanceProfessionalGroup(
        attendance,
        merged.establishmentProfessionals,
        merged.deletedProfessionals
      ),
    [merged.deletedProfessionals, merged.establishmentProfessionals]
  );

  const exclusiveSubscribers = useMemo(() => {
    const map = buildExclusiveSubscribersByGroupKey({
      clientSubscriptions: merged.clientSubscriptions,
      establishmentProfessionals: merged.establishmentProfessionals,
    });
    return map.get(groupKey) || [];
  }, [merged.clientSubscriptions, merged.establishmentProfessionals, groupKey]);

  const exclusiveSubscriberIds = useMemo(
    () => new Set(exclusiveSubscribers.map((item) => item.id)),
    [exclusiveSubscribers]
  );

  const hasData =
    metrics.attendanceCount > 0 ||
    metrics.saleCommissionCount > 0 ||
    metrics.totalPaid > 0 ||
    exclusiveSubscribers.length > 0;

  return {
    loading,
    hasData,
    groupKey,
    periodLabel,
    primaryRange,
    periodRanges,
    metrics,
    professionalGroup,
    exclusiveSubscribers,
    exclusiveSubscriberIds,
    subscriberAttendances: merged.subscriberAttendances,
    clientSubscriptions: merged.clientSubscriptions,
    getProfessionalGroupFromAttendance,
    getAttendanceEffectiveRepass,
    isOwnerProfessional,
    refresh: loadData,
    fmtBRL: (value: number) =>
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0)),
    monthLabelForModal: period === 'last3' ? periodLabel : primaryRange.label,
    modalSelectedMonth: primaryRange.month,
    modalSelectedYear: primaryRange.year,
  };
}

export const formatSubscriberPeriodFilterLabel = (period: SubscriberPerformancePeriod): string => {
  if (period === 'current') return 'Este mês';
  if (period === 'previous') return 'Mês anterior';
  return 'Últimos 3 meses';
};

export const formatMonthLabelPt = (month: number, year: number): string =>
  format(new Date(year, month, 1), 'MMMM yyyy', { locale: ptBR });
