import { supabase } from './supabase';

export const PARTNER_REFERRAL_FREE_ACTIVE_THRESHOLD = 3;
export const PARTNER_REFERRAL_COMMISSION_BRL = 8;

export type PartnerReferralDisplayStatus =
  | 'ativo'
  | 'inadimplente'
  | 'cancelado'
  | 'bloqueado'
  | 'teste';

export type PartnerReferredEstablishmentRow = {
  referralId: string;
  referredEstablishmentId: string;
  establishmentName: string;
  linkedAt: string | null;
  selectedPlan: string;
  referralStatus: string;
  displayStatus: PartnerReferralDisplayStatus;
  displayStatusLabel: string;
  isActiveForCommission: boolean;
  monthlyGenerationLabel: string;
  paymentDueDate: string | null;
  lastAppointmentLabel: string;
};

export type PartnerReferralsDashboardSummary = {
  activeCount: number;
  freeActiveProgress: number;
  freeActiveTarget: number;
  freeMonthMessage: string;
  estimatedMonthlyProfitBrl: number;
};

export type PartnerReferralsDashboardResult = {
  ok: boolean;
  items: PartnerReferredEstablishmentRow[];
  summary: PartnerReferralsDashboardSummary;
  error?: string | null;
  usedFallback?: boolean;
};

type RawDashboardItem = {
  referral_id?: string;
  referred_establishment_id?: string;
  establishment_name?: string;
  linked_at?: string | null;
  created_at?: string | null;
  selected_plan?: string | null;
  referral_status?: string | null;
  payment_status?: string | null;
  payment_due_date?: string | null;
  payment_paid_at?: string | null;
  is_blocked?: boolean | null;
  is_deleted?: boolean | null;
  plan_prata_active?: boolean | null;
  payment_alert_enabled?: boolean | null;
  last_appointment_date?: string | null;
  last_appointment_time?: string | null;
  last_appointment_created_at?: string | null;
};

function parseDateOnlySafe(value?: string | null): number {
  const raw = String(value || '').trim();
  if (!raw) return NaN;
  const onlyDate = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (onlyDate) {
    const y = Number(onlyDate[1]);
    const m = Number(onlyDate[2]) - 1;
    const d = Number(onlyDate[3]);
    return new Date(y, m, d, 12, 0, 0, 0).getTime();
  }
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : NaN;
}

function endOfDayMs(dateMs: number): number {
  const d = new Date(dateMs);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

function isEstablishmentPaymentEmDia(input: {
  payment_status?: string | null;
  payment_due_date?: string | null;
}): boolean {
  const status = String(input.payment_status || '').toLowerCase().trim();
  if (status === 'expired') return false;

  const dueAt = parseDateOnlySafe(input.payment_due_date);
  if (Number.isFinite(dueAt)) {
    if (endOfDayMs(dueAt) < Date.now()) return false;
    return true;
  }

  return status === 'paid';
}

function resolveDisplayStatus(raw: RawDashboardItem): {
  displayStatus: PartnerReferralDisplayStatus;
  displayStatusLabel: string;
} {
  const referralStatus = String(raw.referral_status || 'active').toLowerCase().trim();
  const paymentStatus = String(raw.payment_status || 'unpaid').toLowerCase().trim();

  if (Boolean(raw.is_blocked)) {
    return { displayStatus: 'bloqueado', displayStatusLabel: 'Bloqueado' };
  }
  if (Boolean(raw.is_deleted) || referralStatus === 'cancelled' || referralStatus === 'inactive') {
    return { displayStatus: 'cancelado', displayStatusLabel: 'Cancelado' };
  }
  if (
    paymentStatus === 'unpaid' &&
    !raw.payment_paid_at &&
    !isEstablishmentPaymentEmDia(raw)
  ) {
    return { displayStatus: 'teste', displayStatusLabel: 'Teste' };
  }
  if (!isEstablishmentPaymentEmDia(raw) || paymentStatus === 'expired' || paymentStatus === 'unpaid') {
    return { displayStatus: 'inadimplente', displayStatusLabel: 'Inadimplente' };
  }
  return { displayStatus: 'ativo', displayStatusLabel: 'Ativo' };
}

function isActiveForCommission(raw: RawDashboardItem): boolean {
  const { displayStatus } = resolveDisplayStatus(raw);
  const referralStatus = String(raw.referral_status || 'active').toLowerCase().trim();
  const plan = String(raw.selected_plan || 'diamante').toLowerCase().trim();
  return displayStatus === 'ativo' && referralStatus === 'active' && plan === 'diamante';
}

function formatDatePtBr(value?: string | null): string {
  const raw = String(value || '').trim();
  if (!raw) return '—';
  const onlyDate = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (onlyDate) {
    return `${onlyDate[3]}/${onlyDate[2]}/${onlyDate[1]}`;
  }
  const dt = new Date(raw);
  if (!Number.isFinite(dt.getTime())) return '—';
  return dt.toLocaleDateString('pt-BR');
}

function formatLastAppointmentLabel(raw: RawDashboardItem): string {
  const date = String(raw.last_appointment_date || '').trim();
  const time = String(raw.last_appointment_time || '').trim().slice(0, 5);
  if (date) {
    const formattedDate = formatDatePtBr(date);
    return time ? `${formattedDate} às ${time}` : formattedDate;
  }
  if (raw.last_appointment_created_at) {
    return formatDatePtBr(raw.last_appointment_created_at);
  }
  return 'Nenhum agendamento ainda';
}

function mapRawItem(raw: RawDashboardItem): PartnerReferredEstablishmentRow {
  const { displayStatus, displayStatusLabel } = resolveDisplayStatus(raw);
  const active = isActiveForCommission(raw);

  return {
    referralId: String(raw.referral_id || ''),
    referredEstablishmentId: String(raw.referred_establishment_id || ''),
    establishmentName: String(raw.establishment_name || 'Estabelecimento indicado'),
    linkedAt: raw.linked_at ? String(raw.linked_at) : raw.created_at ? String(raw.created_at) : null,
    selectedPlan: String(raw.selected_plan || 'diamante').toUpperCase(),
    referralStatus: String(raw.referral_status || 'active'),
    displayStatus,
    displayStatusLabel,
    isActiveForCommission: active,
    monthlyGenerationLabel: active ? `+R$${PARTNER_REFERRAL_COMMISSION_BRL}/mês` : 'Pausado',
    paymentDueDate: raw.payment_due_date ? String(raw.payment_due_date) : null,
    lastAppointmentLabel: formatLastAppointmentLabel(raw),
  };
}

export function buildPartnerReferralsDashboardSummary(
  items: PartnerReferredEstablishmentRow[]
): PartnerReferralsDashboardSummary {
  const activeCount = items.filter((item) => item.isActiveForCommission).length;
  const freeActiveTarget = PARTNER_REFERRAL_FREE_ACTIVE_THRESHOLD;
  const freeActiveProgress = Math.min(activeCount, freeActiveTarget);
  const missingForFree = Math.max(0, freeActiveTarget - activeCount);
  const estimatedMonthlyProfitBrl = Math.max(0, activeCount - freeActiveTarget) * PARTNER_REFERRAL_COMMISSION_BRL;

  const freeMonthMessage =
    activeCount >= freeActiveTarget
      ? '✅ Sua mensalidade grátis está ativa.'
      : `Faltam ${missingForFree} cliente${missingForFree === 1 ? '' : 's'} ativo${missingForFree === 1 ? '' : 's'} para sua mensalidade grátis.`;

  return {
    activeCount,
    freeActiveProgress,
    freeActiveTarget,
    freeMonthMessage,
    estimatedMonthlyProfitBrl,
  };
}

function isMissingPartnerReferralsDashboardError(error: unknown): boolean {
  const msg = String((error as any)?.message || '').toLowerCase();
  const code = String((error as any)?.code || '');
  return (
    code === '42883' ||
    code === 'PGRST202' ||
    msg.includes('get_partner_referrals_dashboard') ||
    msg.includes('partner_referrals') &&
      (msg.includes('does not exist') || msg.includes('relation') || msg.includes('schema cache'))
  );
}

async function fetchPartnerReferralsDashboardFallback(
  partnerEstablishmentId: string
): Promise<PartnerReferralsDashboardResult> {
  const { data: referrals, error: referralsError } = await supabase
    .from('partner_referrals')
    .select('id, referred_establishment_id, referral_code, selected_plan, status, linked_at, created_at')
    .eq('partner_establishment_id', partnerEstablishmentId)
    .order('linked_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (referralsError) {
    if (isMissingPartnerReferralsDashboardError(referralsError)) {
      return {
        ok: true,
        items: [],
        summary: buildPartnerReferralsDashboardSummary([]),
        usedFallback: true,
        error: null,
      };
    }
    throw referralsError;
  }

  const referralRows = Array.isArray(referrals) ? referrals : [];
  if (referralRows.length === 0) {
    return {
      ok: true,
      items: [],
      summary: buildPartnerReferralsDashboardSummary([]),
      usedFallback: true,
    };
  }

  const referredIds = referralRows
    .map((row: any) => String(row.referred_establishment_id || '').trim())
    .filter(Boolean);

  const { data: establishments, error: establishmentsError } = await supabase
    .from('establishments')
    .select(
      'id, name, payment_status, payment_due_date, payment_paid_at, is_blocked, is_deleted, plan_prata_active, payment_alert_enabled'
    )
    .in('id', referredIds);

  if (establishmentsError) {
    throw establishmentsError;
  }

  const establishmentById = new Map<string, any>(
    (establishments || []).map((row: any) => [String(row.id), row])
  );

  const items = referralRows.map((row: any) => {
    const est = establishmentById.get(String(row.referred_establishment_id)) || {};
    return mapRawItem({
      referral_id: row.id,
      referred_establishment_id: row.referred_establishment_id,
      establishment_name: est.name,
      linked_at: row.linked_at,
      created_at: row.created_at,
      selected_plan: row.selected_plan,
      referral_status: row.status,
      payment_status: est.payment_status,
      payment_due_date: est.payment_due_date,
      payment_paid_at: est.payment_paid_at,
      is_blocked: est.is_blocked,
      is_deleted: est.is_deleted,
      plan_prata_active: est.plan_prata_active,
      payment_alert_enabled: est.payment_alert_enabled,
    });
  });

  return {
    ok: true,
    items,
    summary: buildPartnerReferralsDashboardSummary(items),
    usedFallback: true,
  };
}

export async function fetchPartnerReferralsDashboard(
  partnerEstablishmentId: string
): Promise<PartnerReferralsDashboardResult> {
  const id = String(partnerEstablishmentId || '').trim();
  if (!id) {
    return {
      ok: false,
      items: [],
      summary: buildPartnerReferralsDashboardSummary([]),
      error: 'Estabelecimento parceiro não informado.',
    };
  }

  try {
    const { data, error } = await supabase.rpc('get_partner_referrals_dashboard', {
      p_partner_establishment_id: id,
    });

    if (error) {
      if (isMissingPartnerReferralsDashboardError(error)) {
        return fetchPartnerReferralsDashboardFallback(id);
      }
      throw error;
    }

    const payload = (data || {}) as { ok?: boolean; error?: string; items?: RawDashboardItem[] };
    if (payload.ok === false && payload.error === 'missing_table') {
      return fetchPartnerReferralsDashboardFallback(id);
    }
    if (payload.ok === false && payload.error === 'forbidden') {
      return {
        ok: false,
        items: [],
        summary: buildPartnerReferralsDashboardSummary([]),
        error: 'Sem permissão para visualizar indicados.',
      };
    }
    if (payload.ok === false && payload.error) {
      return fetchPartnerReferralsDashboardFallback(id);
    }

    const items = (Array.isArray(payload.items) ? payload.items : []).map(mapRawItem);
    return {
      ok: true,
      items,
      summary: buildPartnerReferralsDashboardSummary(items),
    };
  } catch (error: any) {
    if (isMissingPartnerReferralsDashboardError(error)) {
      return fetchPartnerReferralsDashboardFallback(id);
    }
    return {
      ok: false,
      items: [],
      summary: buildPartnerReferralsDashboardSummary([]),
      error: error?.message || 'Não foi possível carregar seus indicados.',
    };
  }
}

export function formatPartnerReferralMoney(value: number): string {
  return `R$${value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function buildPartnerReferralMotivationMessage(summary: PartnerReferralsDashboardSummary): {
  headline: string;
  subline?: string;
} {
  if (summary.estimatedMonthlyProfitBrl > 0) {
    return {
      headline: `Você já está lucrando ${formatPartnerReferralMoney(summary.estimatedMonthlyProfitBrl)}/mês`,
      subline: `${summary.activeCount} indicado${summary.activeCount === 1 ? '' : 's'} ativo${summary.activeCount === 1 ? '' : 's'} no total`,
    };
  }

  const progress = summary.freeActiveProgress;
  const target = summary.freeActiveTarget;
  const remaining = target - progress;

  if (progress >= target) {
    return {
      headline: '🎉 Sistema grátis ativo!',
      subline: 'Indique mais para começar a lucrar R$8/mês por indicado.',
    };
  }

  const headline = `${progress}/${target} indicados ativos`;

  if (remaining === 3) {
    return { headline, subline: 'Faltam 3 indicados para seu sistema ficar grátis.' };
  }
  if (remaining === 2) {
    return { headline, subline: 'Faltam só 2 indicados.' };
  }
  if (remaining === 1) {
    return { headline, subline: 'Falta só 1 indicado para sua mensalidade grátis 🔥' };
  }

  return { headline, subline: `Faltam ${remaining} indicados para seu sistema ficar grátis.` };
}

export type PartnerReferralCommissionBucket = 'mensalidade_gratis' | 'lucro' | 'pausado';

export type PartnerReferredEstablishmentEnrichedRow = PartnerReferredEstablishmentRow & {
  commissionBucket: PartnerReferralCommissionBucket;
  commissionBucketLabel: string;
  monthlyValueLabel: string;
};

export function enrichReferralsWithCommissionBuckets(
  items: PartnerReferredEstablishmentRow[]
): PartnerReferredEstablishmentEnrichedRow[] {
  const activeOrdered = items
    .filter((item) => item.isActiveForCommission)
    .sort((a, b) => {
      const aTime = new Date(String(a.linkedAt || '')).getTime();
      const bTime = new Date(String(b.linkedAt || '')).getTime();
      return (Number.isFinite(aTime) ? aTime : 0) - (Number.isFinite(bTime) ? bTime : 0);
    });

  const activeRank = new Map<string, number>();
  activeOrdered.forEach((item, index) => {
    activeRank.set(item.referralId || item.referredEstablishmentId, index);
  });

  return items.map((item) => {
    if (!item.isActiveForCommission) {
      return {
        ...item,
        commissionBucket: 'pausado',
        commissionBucketLabel: 'Pausado',
        monthlyValueLabel: 'R$0',
      };
    }

    const rank = activeRank.get(item.referralId || item.referredEstablishmentId) ?? 999;
    if (rank < PARTNER_REFERRAL_FREE_ACTIVE_THRESHOLD) {
      return {
        ...item,
        commissionBucket: 'mensalidade_gratis',
        commissionBucketLabel: 'Mensalidade grátis',
        monthlyValueLabel: 'R$0',
      };
    }

    return {
      ...item,
      commissionBucket: 'lucro',
      commissionBucketLabel: 'Lucro',
      monthlyValueLabel: `+R$${PARTNER_REFERRAL_COMMISSION_BRL}`,
    };
  });
}

export function mapPartnerReferralDashboardItem(raw: RawDashboardItem): PartnerReferredEstablishmentRow {
  return mapRawItem(raw);
}

export function countReferralsByDisplayStatus(items: PartnerReferredEstablishmentRow[]) {
  return items.reduce(
    (acc, item) => {
      if (item.displayStatus === 'inadimplente') acc.inadimplente += 1;
      else if (item.displayStatus === 'cancelado') acc.cancelados += 1;
      else if (item.displayStatus === 'bloqueado') acc.bloqueados += 1;
      else if (item.displayStatus === 'teste') acc.teste += 1;
      else if (item.displayStatus === 'ativo') acc.ativos += 1;
      return acc;
    },
    { ativos: 0, inadimplente: 0, cancelados: 0, bloqueados: 0, teste: 0 }
  );
}
