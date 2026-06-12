import { supabase } from './supabase';
import {
  buildPartnerReferralsDashboardSummary,
  countReferralsByDisplayStatus,
  enrichReferralsWithCommissionBuckets,
  formatPartnerReferralMoney,
  mapPartnerReferralDashboardItem,
  PARTNER_REFERRAL_FREE_ACTIVE_THRESHOLD,
  type PartnerReferredEstablishmentEnrichedRow,
  type PartnerReferredEstablishmentRow,
  type PartnerReferralsDashboardSummary,
} from './partnerReferralDashboard';

export type AdminPartnerCollaboratorRow = {
  partnerEstablishmentId: string;
  partnerName: string;
  partnerCode: string;
  couponCode: string | null;
  couponCreatedAt: string | null;
  couponIsActive: boolean;
  totalReferrals: number;
  summary: PartnerReferralsDashboardSummary;
  statusLabel: string;
  referrals: PartnerReferredEstablishmentEnrichedRow[];
  statusCounts: ReturnType<typeof countReferralsByDisplayStatus>;
};

export type AdminPartnerCollaboratorsResult = {
  ok: boolean;
  partners: AdminPartnerCollaboratorRow[];
  error?: string | null;
  usedFallback?: boolean;
};

type RawAdminPartner = {
  partner_establishment_id?: string;
  partner_name?: string;
  partner_code?: string;
  coupon_code?: string | null;
  coupon_created_at?: string | null;
  coupon_is_active?: boolean | null;
  referrals?: unknown[];
};

function isMissingAdminCollaboratorsError(error: unknown): boolean {
  const msg = String((error as any)?.message || '').toLowerCase();
  const code = String((error as any)?.code || '');
  return (
    code === '42883' ||
    code === 'PGRST202' ||
    msg.includes('get_admin_partner_collaborators') ||
    (msg.includes('partner_referral') &&
      (msg.includes('does not exist') || msg.includes('relation') || msg.includes('schema cache')))
  );
}

function buildPartnerStatusLabel(summary: PartnerReferralsDashboardSummary, totalReferrals: number): string {
  if (summary.activeCount >= PARTNER_REFERRAL_FREE_ACTIVE_THRESHOLD) {
    return 'Mensalidade grátis ativa';
  }
  if (summary.activeCount > 0) {
    return 'Em progresso';
  }
  if (totalReferrals > 0) {
    return 'Sem indicados ativos';
  }
  return 'Aguardando indicações';
}

function mapAdminPartner(raw: RawAdminPartner): AdminPartnerCollaboratorRow {
  const referralsRaw = Array.isArray(raw.referrals) ? raw.referrals : [];
  const referrals = referralsRaw.map((item) => mapPartnerReferralDashboardItem(item as any));
  const enriched = enrichReferralsWithCommissionBuckets(referrals);
  const summary = buildPartnerReferralsDashboardSummary(referrals);

  return {
    partnerEstablishmentId: String(raw.partner_establishment_id || ''),
    partnerName: String(raw.partner_name || 'Parceiro'),
    partnerCode: String(raw.partner_code || ''),
    couponCode: raw.coupon_code ? String(raw.coupon_code) : null,
    couponCreatedAt: raw.coupon_created_at ? String(raw.coupon_created_at) : null,
    couponIsActive: Boolean(raw.coupon_is_active),
    totalReferrals: referrals.length,
    summary,
    statusLabel: buildPartnerStatusLabel(summary, referrals.length),
    referrals: enriched,
    statusCounts: countReferralsByDisplayStatus(referrals),
  };
}

function filterEligiblePartners(partners: AdminPartnerCollaboratorRow[]): AdminPartnerCollaboratorRow[] {
  return partners.filter(
    (partner) =>
      Boolean(partner.couponCode) ||
      partner.totalReferrals > 0 ||
      partner.summary.activeCount >= PARTNER_REFERRAL_FREE_ACTIVE_THRESHOLD
  );
}

async function fetchAdminPartnerCollaboratorsFallback(): Promise<AdminPartnerCollaboratorsResult> {
  const { data: codes, error: codesError } = await supabase
    .from('partner_referral_codes')
    .select('establishment_id, code, is_active, created_at');

  if (codesError && isMissingAdminCollaboratorsError(codesError)) {
    return { ok: true, partners: [], usedFallback: true };
  }
  if (codesError) throw codesError;

  const { data: referrals, error: referralsError } = await supabase
    .from('partner_referrals')
    .select('id, partner_establishment_id, referred_establishment_id, selected_plan, status, linked_at, created_at');

  if (referralsError && isMissingAdminCollaboratorsError(referralsError)) {
    return { ok: true, partners: [], usedFallback: true };
  }
  if (referralsError) throw referralsError;

  const codeRows = Array.isArray(codes) ? codes : [];
  const referralRows = Array.isArray(referrals) ? referrals : [];
  const partnerIds = new Set<string>();
  codeRows.forEach((row: any) => partnerIds.add(String(row.establishment_id)));
  referralRows.forEach((row: any) => partnerIds.add(String(row.partner_establishment_id)));

  if (partnerIds.size === 0) {
    return { ok: true, partners: [], usedFallback: true };
  }

  const referredIds = referralRows
    .map((row: any) => String(row.referred_establishment_id || '').trim())
    .filter(Boolean);

  const { data: partnerEstablishments } = await supabase
    .from('establishments')
    .select('id, name, code')
    .in('id', Array.from(partnerIds));

  const { data: referredEstablishments } = referredIds.length
    ? await supabase
        .from('establishments')
        .select(
          'id, name, payment_status, payment_due_date, payment_paid_at, is_blocked, is_deleted, plan_prata_active, payment_alert_enabled'
        )
        .in('id', referredIds)
    : { data: [] as any[] };

  const partnerById = new Map((partnerEstablishments || []).map((row: any) => [String(row.id), row]));
  const referredById = new Map((referredEstablishments || []).map((row: any) => [String(row.id), row]));
  const codeByPartnerId = new Map(codeRows.map((row: any) => [String(row.establishment_id), row]));

  const partners = Array.from(partnerIds).map((partnerId) => {
    const partner = partnerById.get(partnerId) || {};
    const code = codeByPartnerId.get(partnerId);
    const partnerReferrals = referralRows.filter((row: any) => String(row.partner_establishment_id) === partnerId);

    const referralItems = partnerReferrals.map((row: any) => {
      const est = referredById.get(String(row.referred_establishment_id)) || {};
      return mapPartnerReferralDashboardItem({
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

    const enriched = enrichReferralsWithCommissionBuckets(referralItems);
    const summary = buildPartnerReferralsDashboardSummary(referralItems);

    return {
      partnerEstablishmentId: partnerId,
      partnerName: String(partner.name || 'Parceiro'),
      partnerCode: String(partner.code || ''),
      couponCode: code?.code ? String(code.code) : null,
      couponCreatedAt: code?.created_at ? String(code.created_at) : null,
      couponIsActive: Boolean(code?.is_active),
      totalReferrals: referralItems.length,
      summary,
      statusLabel: buildPartnerStatusLabel(summary, referralItems.length),
      referrals: enriched,
      statusCounts: countReferralsByDisplayStatus(referralItems),
    } satisfies AdminPartnerCollaboratorRow;
  });

  return {
    ok: true,
    partners: filterEligiblePartners(partners),
    usedFallback: true,
  };
}

export async function fetchAdminPartnerCollaborators(): Promise<AdminPartnerCollaboratorsResult> {
  try {
    const { data, error } = await supabase.rpc('get_admin_partner_collaborators');

    if (error) {
      if (isMissingAdminCollaboratorsError(error)) {
        return fetchAdminPartnerCollaboratorsFallback();
      }
      throw error;
    }

    const payload = (data || {}) as { ok?: boolean; error?: string; partners?: RawAdminPartner[] };
    if (payload.ok === false && payload.error === 'forbidden') {
      return { ok: false, partners: [], error: 'Acesso restrito ao admin.' };
    }
    if (payload.ok === false && (payload.error === 'missing_table' || payload.error)) {
      return fetchAdminPartnerCollaboratorsFallback();
    }

    const partners = filterEligiblePartners(
      (Array.isArray(payload.partners) ? payload.partners : []).map(mapAdminPartner)
    );

    return { ok: true, partners };
  } catch (error: any) {
    if (isMissingAdminCollaboratorsError(error)) {
      return fetchAdminPartnerCollaboratorsFallback();
    }
    return {
      ok: false,
      partners: [],
      error: error?.message || 'Não foi possível carregar colaboradores.',
    };
  }
}

export function formatAdminPartnerDate(value?: string | null): string {
  const raw = String(value || '').trim();
  if (!raw) return '—';
  const dt = new Date(raw);
  if (!Number.isFinite(dt.getTime())) return '—';
  return dt.toLocaleDateString('pt-BR');
}

export function formatAdminPartnerDueDate(value?: string | null): string {
  const raw = String(value || '').trim();
  if (!raw) return '—';
  const onlyDate = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (onlyDate) return `${onlyDate[3]}/${onlyDate[2]}/${onlyDate[1]}`;
  return formatAdminPartnerDate(raw);
}

export { formatPartnerReferralMoney };

export type { PartnerReferredEstablishmentEnrichedRow, PartnerReferredEstablishmentRow };
