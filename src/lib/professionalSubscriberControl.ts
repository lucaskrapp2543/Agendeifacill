import { format } from 'date-fns';
import {
  buildSubscriptionsByNameMap,
  buildSubscriptionsByPhoneMap,
  findMatchingSubscriptionForAppointment,
  normalizeSubscriberNameKey,
} from './subscriberAppointmentFlags';
import {
  computeSubscriberRepassValue,
  filterSubscriberAttendancesForFinance,
  getEstablishmentSubscribers,
  mergeSubscriberAttendancesWithCompletedAppointments,
  normalizeProfessionalNameKey,
  resolveSubscriberAttendanceProfessionalGroup,
  type EstablishmentProfessionalRef,
} from './subscriberSystem';
import { getClientSubscriptions, getSubscriptions, supabase } from './supabase';

export type ProfessionalControlGroupData = {
  groupKey: string;
  displayName: string;
  professionalId: string | null;
  totalValue: number;
  attendanceTotalValue: number;
  attendanceRecords: Array<{ attendance_date: string; repassValue: number }>;
  pointsFromAttendances: number;
  attendanceCount: number;
  uniqueClientIds: Set<string>;
  saleCommissionCount: number;
};

export type ProfessionalControlSnapshot = {
  month: number;
  year: number;
  monthStart: string;
  monthEnd: string;
  forMonthKey: string;
  label: string;
  subscriberAttendances: any[];
  subscriptionSaleCommissions: any[];
  professionalPayments: any[];
  clientSubscriptions: any[];
  subscriptions: any[];
  establishmentProfessionals: EstablishmentProfessionalRef[];
  deletedProfessionals: EstablishmentProfessionalRef[];
};

const monthNames = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export const buildProfessionalControlMonthRange = (month: number, year: number) => {
  const monthStart = format(new Date(year, month, 1), 'yyyy-MM-dd');
  const monthEnd = format(new Date(year, month + 1, 0), 'yyyy-MM-dd');
  return {
    month,
    year,
    monthStart,
    monthEnd,
    forMonthKey: format(new Date(year, month, 1), 'yyyy-MM'),
    label: `${monthNames[month]} ${year}`,
  };
};

const parseLegacyBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 't' || normalized === 'sim' || normalized === 'yes' || normalized === 'on';
};

export const normalizeProfessionalPercentage = (raw: unknown): number => {
  const value = Number(String(raw ?? '').replace(',', '.'));
  return Number.isFinite(value) ? value : 0;
};

export const mapEstablishmentProfessionalsForGrouping = (professionalsRaw: unknown): EstablishmentProfessionalRef[] =>
  (Array.isArray(professionalsRaw) ? professionalsRaw : [])
    .map((pro: any) => ({
      id: String(pro?.id || pro?.name || '').trim(),
      name: String(pro?.full_name || pro?.name || '').trim(),
    }))
    .filter((pro) => pro.id && pro.name);

export const createProfessionalControlHelpers = (
  clientSubscriptions: any[],
  subscriptions: any[]
) => {
  const resolveSubscriptionConfigForClientSubId = (clientSubId: string): { divide: boolean; fixed: number } | null => {
    const id = String(clientSubId || '').trim();
    if (!id) return null;
    const cs = (clientSubscriptions || []).find((c: any) => String(c?.id) === id);
    if (!cs) return null;
    const nested = (cs as any)?.subscriptions;
    const sub =
      nested && (nested as any).id != null
        ? nested
        : subscriptions.find((s: any) => String(s.id) === String((cs as any).subscription_id));
    if (!sub) return null;
    return {
      divide: parseLegacyBoolean((sub as any).divide_total_enabled),
      fixed: Number((sub as any).fixed_commission_value || 0),
    };
  };

  const isClientSubscriptionPointsMode = (clientSubId: string): boolean => {
    const cfg = resolveSubscriptionConfigForClientSubId(clientSubId);
    if (!cfg) return false;
    return !cfg.divide && !(cfg.fixed > 0);
  };

  const getAttendanceEffectiveRepass = (attendance: any): number => {
    const clientSubId = String(attendance?.client_subscription_id || '').trim();
    if (clientSubId && isClientSubscriptionPointsMode(clientSubId)) {
      return 0;
    }

    const cs = (clientSubscriptions || []).find((c: any) => String(c?.id) === clientSubId);
    if (cs) {
      const nested = (cs as any)?.subscriptions;
      const sub =
        nested && (nested as any).id != null
          ? nested
          : subscriptions.find((s: any) => String(s.id) === String((cs as any).subscription_id));
      if (sub) {
        return computeSubscriberRepassValue({
          subscription: sub,
          monthlyLimit: Number((cs as any).monthly_limit || 0),
          appointmentPrice: 0,
        });
      }
    }

    const storedValue = Number(attendance?.repass_value || 0);
    return Number.isFinite(storedValue) ? storedValue : 0;
  };

  return {
    resolveSubscriptionConfigForClientSubId,
    isClientSubscriptionPointsMode,
    getAttendanceEffectiveRepass,
  };
};

/** Mesma query de Meus Assinantes → fetchSubscriberAttendances */
export async function fetchSubscriberAttendancesForControlMonth(params: {
  establishmentId: string;
  month: number;
  year: number;
  establishmentProfessionals: EstablishmentProfessionalRef[];
}): Promise<any[]> {
  const range = buildProfessionalControlMonthRange(params.month, params.year);

  const applyRows = async (rows: any[] | null | undefined) => {
    const filtered = await filterSubscriberAttendancesForFinance(rows || [], params.establishmentId);
    return mergeSubscriberAttendancesWithCompletedAppointments({
      establishmentId: params.establishmentId,
      monthStart: range.monthStart,
      monthEnd: range.monthEnd,
      existingRows: filtered,
      professionals: params.establishmentProfessionals,
    });
  };

  const { data, error } = await supabase
    .from('subscriber_attendances')
    .select(`
      id,
      professional_name,
      professional_id,
      attendance_date,
      repass_value,
      created_at,
      client_subscription_id,
      appointment_id,
      client_name_snapshot,
      subscription_name_snapshot
    `)
    .eq('establishment_id', params.establishmentId)
    .gte('attendance_date', range.monthStart)
    .lte('attendance_date', range.monthEnd)
    .order('attendance_date', { ascending: false });

  if (error && String((error as any)?.message || '').toLowerCase().includes('professional_id')) {
    const fallback = await supabase
      .from('subscriber_attendances')
      .select(`
        id,
        professional_name,
        attendance_date,
        repass_value,
        created_at,
        client_subscription_id,
        appointment_id,
        client_name_snapshot,
        subscription_name_snapshot
      `)
      .eq('establishment_id', params.establishmentId)
      .gte('attendance_date', range.monthStart)
      .lte('attendance_date', range.monthEnd)
      .order('attendance_date', { ascending: false });
    return applyRows(fallback.data || []);
  }

  if (error) {
    const legacyFallback = await supabase
      .from('subscriber_attendances')
      .select(`
        id,
        professional_name,
        attendance_date,
        repass_value,
        created_at,
        client_subscription_id
      `)
      .eq('establishment_id', params.establishmentId)
      .gte('attendance_date', range.monthStart)
      .lte('attendance_date', range.monthEnd)
      .order('attendance_date', { ascending: false });
    if (legacyFallback.error) throw legacyFallback.error;
    return applyRows(legacyFallback.data || []);
  }

  return applyRows(data || []);
}

/** Mesma query de Meus Assinantes → fetchSubscriptionSaleCommissions */
export async function fetchSubscriptionSaleCommissionsForControlMonth(params: {
  establishmentId: string;
  month: number;
  year: number;
}): Promise<any[]> {
  const firstDayOfMonth = new Date(params.year, params.month, 1);
  const lastDayOfMonth = new Date(params.year, params.month + 1, 0, 23, 59, 59);

  const { data, error } = await supabase
    .from('subscription_sale_commissions')
    .select('id, professional_name, commission_percent, commission_amount, created_at, client_subscription_id')
    .eq('establishment_id', params.establishmentId)
    .gte('created_at', firstDayOfMonth.toISOString())
    .lte('created_at', lastDayOfMonth.toISOString())
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/** Mesma query de Meus Assinantes → fetchProfessionalPayments */
export async function fetchProfessionalPaymentsForControlMonth(params: {
  establishmentId: string;
  month: number;
  year: number;
}): Promise<any[]> {
  const periodStart = new Date(params.year, params.month, 1);
  const periodEnd = new Date(params.year, params.month + 1, 0, 23, 59, 59, 999);
  const targetForMonth = format(periodStart, 'yyyy-MM');

  const { data, error } = await supabase
    .from('professional_payments')
    .select('*')
    .eq('establishment_id', params.establishmentId)
    .eq('payment_source', 'subscription')
    .order('payment_date', { ascending: false });

  if (error) throw error;

  return ((data || []) as any[]).filter((payment) => {
    const rawAmount = Number((payment as any)?.amount || 0);
    if (!Number.isFinite(rawAmount) || rawAmount <= 0) return false;

    const forMonth = String((payment as any)?.for_month || '').trim();
    if (forMonth) {
      return forMonth === targetForMonth;
    }

    const rawPaymentDate = String((payment as any)?.payment_date || '').trim();
    if (!rawPaymentDate) return false;
    const paymentDate = new Date(rawPaymentDate);
    if (Number.isNaN(paymentDate.getTime())) return false;
    return paymentDate >= periodStart && paymentDate <= periodEnd;
  });
}

export async function fetchClientSubscriptionsForControl(establishmentId: string): Promise<any[]> {
  const byId = new Map<string, any>();

  const { data: primary, error: primaryError } = await getEstablishmentSubscribers(establishmentId);
  if (!primaryError && Array.isArray(primary)) {
    primary.forEach((row: any) => {
      const id = String(row?.id || '').trim();
      if (id) byId.set(id, row);
    });
  }

  try {
    const { data: fallback, error: fallbackError } = await getClientSubscriptions(establishmentId, {});
    if (!fallbackError && Array.isArray(fallback)) {
      fallback.forEach((row: any) => {
        const id = String(row?.id || '').trim();
        if (id && !byId.has(id)) byId.set(id, row);
      });
    }
  } catch {
    // Mantém só o primário se o fallback falhar.
  }

  if (byId.size === 0 && primaryError) throw primaryError;
  return Array.from(byId.values());
}

const GENERIC_SUBSCRIBER_NAME_KEYS = new Set([
  'encaixe',
  'cliente',
  'assinante',
  'nao informado',
  'não informado',
]);

/** Nome avulso/placeholder — não entra no controle financeiro de assinatura. */
export function isGenericSubscriberControlClientName(name: unknown): boolean {
  const key = normalizeSubscriberNameKey(
    String(name || '')
      .replace(/\(\s*assinante\s*\)/gi, '')
      .replace(/👑/g, '')
  );
  return !key || GENERIC_SUBSCRIBER_NAME_KEYS.has(key);
}

/**
 * Só conta se o atendimento pertence a alguém cadastrado em Meus Assinantes.
 * Fallback: match por WhatsApp/nome no cadastro (nunca por valor ou flag solta).
 */
export function resolveVerifiedMeusAssinantesClientSubscriptionId(
  attendance: any,
  clientSubscriptions: any[]
): string | null {
  const rows = Array.isArray(clientSubscriptions) ? clientSubscriptions : [];
  if (rows.length === 0) return null;

  const byId = new Map<string, any>();
  rows.forEach((row) => {
    const id = String(row?.id || '').trim();
    if (id) byId.set(id, row);
  });

  const directId = String(attendance?.client_subscription_id || '').trim();
  if (directId && byId.has(directId)) return directId;

  const snapshotName = String(attendance?.client_name_snapshot || '').trim();
  if (!snapshotName || isGenericSubscriberControlClientName(snapshotName)) return null;

  const subscriptionsByPhone = buildSubscriptionsByPhoneMap(rows);
  const subscriptionsByName = buildSubscriptionsByNameMap(rows);
  const matched = findMatchingSubscriptionForAppointment(
    {
      client_name: snapshotName,
      client_whatsapp: attendance?.client_whatsapp || '',
      appointment_date: attendance?.attendance_date,
    },
    subscriptionsByPhone,
    subscriptionsByName
  );

  const matchedId = String(matched?.id || '').trim();
  return matchedId && byId.has(matchedId) ? matchedId : null;
}

export function isVerifiedMeusAssinantesControlAttendance(
  attendance: any,
  clientSubscriptions: any[]
): boolean {
  return Boolean(resolveVerifiedMeusAssinantesClientSubscriptionId(attendance, clientSubscriptions));
}

/** Normaliza atendimentos: só assinantes reais de Meus Assinantes, com ID garantido. */
export function enrichVerifiedSubscriberControlAttendances(
  attendances: any[],
  clientSubscriptions: any[]
): any[] {
  const verified: any[] = [];
  (attendances || []).forEach((row) => {
    const verifiedId = resolveVerifiedMeusAssinantesClientSubscriptionId(row, clientSubscriptions);
    if (!verifiedId) return;
    verified.push({
      ...row,
      client_subscription_id: verifiedId,
      __verified_meus_assinantes: true,
    });
  });
  return verified;
}

export function filterVerifiedSubscriptionSaleCommissions(
  rows: any[],
  clientSubscriptions: any[]
): any[] {
  const allowed = new Set(
    (clientSubscriptions || []).map((row) => String(row?.id || '').trim()).filter(Boolean)
  );
  return (rows || []).filter((row) => {
    const clientSubId = String(row?.client_subscription_id || '').trim();
    return clientSubId && allowed.has(clientSubId);
  });
}

export async function loadProfessionalControlSnapshot(params: {
  establishmentId: string;
  month: number;
  year: number;
}): Promise<ProfessionalControlSnapshot> {
  const range = buildProfessionalControlMonthRange(params.month, params.year);

  const establishmentRes = await supabase
    .from('establishments')
    .select('professionals, deleted_professionals')
    .eq('id', params.establishmentId)
    .maybeSingle();

  if (establishmentRes.error) throw establishmentRes.error;

  const establishmentProfessionals = mapEstablishmentProfessionalsForGrouping(
    (establishmentRes.data as any)?.professionals
  );
  const deletedProfessionals = mapEstablishmentProfessionalsForGrouping(
    (establishmentRes.data as any)?.deleted_professionals
  );

  const [subscriptionsRes, clientSubscriptions, subscriberAttendances, subscriptionSaleCommissions, professionalPayments] =
    await Promise.all([
      getSubscriptions(params.establishmentId),
      fetchClientSubscriptionsForControl(params.establishmentId),
      fetchSubscriberAttendancesForControlMonth({
        establishmentId: params.establishmentId,
        month: params.month,
        year: params.year,
        establishmentProfessionals,
      }),
      fetchSubscriptionSaleCommissionsForControlMonth({
        establishmentId: params.establishmentId,
        month: params.month,
        year: params.year,
      }),
      fetchProfessionalPaymentsForControlMonth({
        establishmentId: params.establishmentId,
        month: params.month,
        year: params.year,
      }),
    ]);

  if (subscriptionsRes.error) throw subscriptionsRes.error;

  const verifiedAttendances = enrichVerifiedSubscriberControlAttendances(
    subscriberAttendances,
    clientSubscriptions
  );
  const verifiedSaleCommissions = filterVerifiedSubscriptionSaleCommissions(
    subscriptionSaleCommissions,
    clientSubscriptions
  );

  return {
    month: params.month,
    year: params.year,
    monthStart: range.monthStart,
    monthEnd: range.monthEnd,
    forMonthKey: range.forMonthKey,
    label: range.label,
    subscriberAttendances: verifiedAttendances,
    subscriptionSaleCommissions: verifiedSaleCommissions,
    professionalPayments,
    clientSubscriptions,
    subscriptions: subscriptionsRes.data || [],
    establishmentProfessionals,
    deletedProfessionals,
  };
}

/** Mesma agregação do useMemo professionalControlGroups em Meus Assinantes */
export function buildProfessionalControlGroups(params: {
  subscriberAttendances: any[];
  subscriptionSaleCommissions: any[];
  establishmentProfessionals: EstablishmentProfessionalRef[];
  deletedProfessionals: EstablishmentProfessionalRef[];
  clientSubscriptions: any[];
  subscriptions: any[];
}): ProfessionalControlGroupData[] {
  const helpers = createProfessionalControlHelpers(params.clientSubscriptions, params.subscriptions);
  const { getAttendanceEffectiveRepass, isClientSubscriptionPointsMode } = helpers;

  const getProfessionalGroupFromAttendance = (attendance: any) =>
    resolveSubscriberAttendanceProfessionalGroup(
      attendance,
      params.establishmentProfessionals,
      params.deletedProfessionals
    );

  const activeProfessionalIdSet = new Set(
    params.establishmentProfessionals.map((pro) => String(pro?.id || '').trim()).filter(Boolean)
  );

  const verifiedAttendances = enrichVerifiedSubscriberControlAttendances(
    params.subscriberAttendances,
    params.clientSubscriptions
  );
  const verifiedSaleCommissions = filterVerifiedSubscriptionSaleCommissions(
    params.subscriptionSaleCommissions,
    params.clientSubscriptions
  );

  const acc: Record<string, ProfessionalControlGroupData> = {};

  verifiedAttendances.forEach((attendance: any) => {
    const group = getProfessionalGroupFromAttendance(attendance);
    const groupKey = group.groupKey;
    if (!group.professionalId || !activeProfessionalIdSet.has(String(group.professionalId))) return;
    if (!acc[groupKey]) {
      acc[groupKey] = {
        groupKey,
        displayName: group.displayName,
        professionalId: group.professionalId,
        totalValue: 0,
        attendanceTotalValue: 0,
        attendanceRecords: [],
        pointsFromAttendances: 0,
        attendanceCount: 0,
        uniqueClientIds: new Set<string>(),
        saleCommissionCount: 0,
      };
    }
    const repassForAttendance = getAttendanceEffectiveRepass(attendance);
    acc[groupKey].totalValue += repassForAttendance;
    acc[groupKey].attendanceTotalValue += repassForAttendance;
    acc[groupKey].attendanceRecords.push({
      attendance_date: String(attendance.attendance_date || ''),
      repassValue: repassForAttendance,
    });
    acc[groupKey].attendanceCount += 1;

    const clientSubId = String(attendance.client_subscription_id || '').trim();
    if (clientSubId) {
      acc[groupKey].uniqueClientIds.add(clientSubId);
      if (isClientSubscriptionPointsMode(clientSubId)) {
        acc[groupKey].pointsFromAttendances += 1;
      }
    }
  });

  verifiedSaleCommissions.forEach((item: any) => {
    const group = getProfessionalGroupFromAttendance(item);
    const groupKey = group.groupKey;
    if (!group.professionalId || !activeProfessionalIdSet.has(String(group.professionalId))) return;
    if (!acc[groupKey]) {
      acc[groupKey] = {
        groupKey,
        displayName: group.displayName,
        professionalId: group.professionalId,
        totalValue: 0,
        attendanceTotalValue: 0,
        attendanceRecords: [],
        pointsFromAttendances: 0,
        attendanceCount: 0,
        uniqueClientIds: new Set<string>(),
        saleCommissionCount: 0,
      };
    }
    acc[groupKey].totalValue += parseFloat(String(item.commission_amount || 0)) || 0;
    acc[groupKey].saleCommissionCount += 1;
  });

  return Object.values(acc).sort(
    (a, b) => b.totalValue - a.totalValue || b.attendanceCount - a.attendanceCount
  );
}

export function buildExclusiveSubscribersByGroupKey(params: {
  clientSubscriptions: any[];
  establishmentProfessionals: EstablishmentProfessionalRef[];
}): Map<string, Array<{ id: string; name: string }>> {
  const map = new Map<string, Array<{ id: string; name: string }>>();

  (params.clientSubscriptions || []).forEach((cs: any) => {
    const profId = String(cs?.subscriber_professional_id || '').trim();
    const profName = String(cs?.subscriber_professional_name || '').trim();
    if (!profId && !profName) return;

    let groupKey = '';
    if (profId) {
      groupKey = `id:${profId}`;
    } else {
      const activeMatch = params.establishmentProfessionals.find(
        (pro) => normalizeProfessionalNameKey(pro.name) === normalizeProfessionalNameKey(profName)
      );
      groupKey = activeMatch?.id ? `id:${activeMatch.id}` : `name:${normalizeProfessionalNameKey(profName)}`;
    }

    const subscriberName =
      String(cs?.client_name_override || cs?.subscriber_name || cs?.profiles?.full_name || 'Assinante').trim() ||
      'Assinante';

    const list = map.get(groupKey) || [];
    if (!list.some((item) => item.id === String(cs.id))) {
      list.push({ id: String(cs.id), name: subscriberName });
    }
    map.set(groupKey, list);
  });

  map.forEach((list, key) => {
    map.set(key, [...list].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
  });

  return map;
}

export function resolveProfessionalControlGroupMetrics(params: {
  group: ProfessionalControlGroupData;
  professionalPayments: any[];
  establishmentProfessionals: EstablishmentProfessionalRef[];
  deletedProfessionals: EstablishmentProfessionalRef[];
  isOwnerProfessional: boolean;
}) {
  const getProfessionalGroupFromAttendance = (attendance: any) =>
    resolveSubscriberAttendanceProfessionalGroup(
      attendance,
      params.establishmentProfessionals,
      params.deletedProfessionals
    );

  const groupPayments = params.professionalPayments.filter((p) => {
    if (p.payment_source !== 'subscription') return false;
    const paymentGroup = getProfessionalGroupFromAttendance({
      professional_id: p.professional_id,
      professional_name: p.professional_name,
    });
    return paymentGroup.groupKey === params.group.groupKey;
  });

  const totalPaid = groupPayments.reduce((sum, p) => sum + (Number(p.amount || 0) || 0), 0);

  const liquidValue = params.group.attendanceTotalValue ?? params.group.totalValue;

  // Pendente = atendimentos APÓS a data do último pagamento
  let pendingValue: number;
  if (params.isOwnerProfessional) {
    pendingValue = 0;
  } else if (groupPayments.length === 0) {
    pendingValue = liquidValue;
  } else {
    const lastPaymentDate = groupPayments
      .map((p) => String(p.payment_date || '').substring(0, 10))
      .filter(Boolean)
      .sort()
      .at(-1) ?? '';

    pendingValue = (params.group.attendanceRecords || [])
      .filter((r) => String(r.attendance_date || '').substring(0, 10) > lastPaymentDate)
      .reduce((sum, r) => sum + r.repassValue, 0);
  }
  const averageTicket =
    params.group.attendanceCount > 0 && liquidValue > 0
      ? liquidValue / params.group.attendanceCount
      : 0;

  return {
    totalValue: liquidValue,
    attendanceCount: params.group.attendanceCount,
    averageTicket,
    totalPaid,
    pendingValue,
    uniqueClientsCount: params.group.uniqueClientIds.size,
    saleCommissionCount: params.group.saleCommissionCount,
    pointsFromAttendances: params.group.pointsFromAttendances,
  };
}

export function mergeProfessionalControlSnapshots(snapshots: ProfessionalControlSnapshot[]): {
  subscriberAttendances: any[];
  subscriptionSaleCommissions: any[];
  professionalPayments: any[];
  clientSubscriptions: any[];
  subscriptions: any[];
  establishmentProfessionals: EstablishmentProfessionalRef[];
  deletedProfessionals: EstablishmentProfessionalRef[];
} {
  const attendanceMap = new Map<string, any>();
  const commissionMap = new Map<string, any>();
  const paymentMap = new Map<string, any>();
  const clientSubMap = new Map<string, any>();
  const subscriptionMap = new Map<string, any>();

  snapshots.forEach((snapshot) => {
    snapshot.subscriberAttendances.forEach((row) => {
      const id = String(row?.id || `${row?.attendance_date}-${row?.client_subscription_id}-${row?.professional_name}`);
      attendanceMap.set(id, row);
    });
    snapshot.subscriptionSaleCommissions.forEach((row) => {
      const id = String(row?.id || `${row?.created_at}-${row?.client_subscription_id}-${row?.professional_name}`);
      commissionMap.set(id, row);
    });
    snapshot.professionalPayments.forEach((row) => {
      const id = String(row?.id || `${row?.payment_date}-${row?.professional_name}-${row?.amount}`);
      paymentMap.set(id, row);
    });
    snapshot.clientSubscriptions.forEach((row) => {
      const id = String(row?.id || '');
      if (id) clientSubMap.set(id, row);
    });
    snapshot.subscriptions.forEach((row) => {
      const id = String(row?.id || '');
      if (id) subscriptionMap.set(id, row);
    });
  });

  const lastSnapshot = snapshots[snapshots.length - 1];

  return {
    subscriberAttendances: Array.from(attendanceMap.values()),
    subscriptionSaleCommissions: Array.from(commissionMap.values()),
    professionalPayments: Array.from(paymentMap.values()),
    clientSubscriptions: Array.from(clientSubMap.values()),
    subscriptions: Array.from(subscriptionMap.values()),
    establishmentProfessionals: lastSnapshot?.establishmentProfessionals || [],
    deletedProfessionals: lastSnapshot?.deletedProfessionals || [],
  };
}
