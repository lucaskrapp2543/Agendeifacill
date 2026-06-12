import { supabase } from './supabase';
import {
  PARTNER_REFERRAL_FREE_ACTIVE_THRESHOLD,
  type PartnerReferralsDashboardSummary,
} from './partnerReferralDashboard';

export type PartnerFreeMonthlyRecordStatus = 'eligible' | 'applied' | 'lost';

export type PartnerFreeMonthlyHistoryRow = {
  id: string;
  partnerEstablishmentId: string;
  referenceMonth: string;
  activeReferralsCount: number;
  status: PartnerFreeMonthlyRecordStatus;
  appliedAt?: string | null;
  appliedBy?: string | null;
  notes?: string | null;
  createdAt?: string | null;
};

export type PartnerFreeMonthlyView = {
  isEligible: boolean;
  isActiveBenefit: boolean;
  isProtectedThisCycle: boolean;
  appliedThisMonth: boolean;
  lostBenefitHint: boolean;
  activeCount: number;
  targetCount: number;
  progressLabel: string;
  statusLabel: string;
  statusTone: 'active' | 'inactive' | 'progress' | 'lost';
  protectionMessage: string;
  nextDueDateLabel: string;
  adminListBadge: string;
  adminListBadgeTone: 'active' | 'progress' | 'lost' | 'neutral';
};

const SP_TIMEZONE = 'America/Sao_Paulo';

function mapHistoryRow(raw: any): PartnerFreeMonthlyHistoryRow {
  return {
    id: String(raw.id),
    partnerEstablishmentId: String(raw.partner_establishment_id),
    referenceMonth: String(raw.reference_month || ''),
    activeReferralsCount: Number(raw.active_referrals_count || 0),
    status: String(raw.status || 'eligible') as PartnerFreeMonthlyRecordStatus,
    appliedAt: raw.applied_at ? String(raw.applied_at) : null,
    appliedBy: raw.applied_by ? String(raw.applied_by) : null,
    notes: raw.notes ? String(raw.notes) : null,
    createdAt: raw.created_at ? String(raw.created_at) : null,
  };
}

function isMissingFreeMonthlyTableError(error: unknown): boolean {
  const msg = String((error as any)?.message || '').toLowerCase();
  const code = String((error as any)?.code || '');
  return (
    code === '42883' ||
    code === 'PGRST202' ||
    msg.includes('partner_free_monthly') ||
    (msg.includes('does not exist') && msg.includes('free_monthly'))
  );
}

export function getBrazilMonthKey(referenceDate = new Date()): string {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: SP_TIMEZONE,
    month: '2-digit',
    year: 'numeric',
  });
  return formatter.format(referenceDate);
}

export function formatPartnerPaymentDueDate(value?: string | null): string {
  const raw = String(value || '').trim();
  if (!raw) return '—';
  const onlyDate = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (onlyDate) return `${onlyDate[3]}/${onlyDate[2]}/${onlyDate[1]}`;
  const dt = new Date(raw);
  if (!Number.isFinite(dt.getTime())) return '—';
  return dt.toLocaleDateString('pt-BR', { timeZone: SP_TIMEZONE });
}

export function formatPartnerFreeMonthlyReferenceMonth(value?: string | null): string {
  const raw = String(value || '').trim();
  if (!raw) return '—';
  const onlyDate = /^(\d{4})-(\d{2})/.exec(raw);
  if (onlyDate) {
    const month = Number(onlyDate[2]) - 1;
    const year = Number(onlyDate[1]);
    const dt = new Date(year, month, 1);
    return dt.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }
  return formatPartnerPaymentDueDate(raw);
}

export function getPartnerFreeMonthlyStatusLabel(status: PartnerFreeMonthlyRecordStatus): string {
  if (status === 'applied') return 'Aplicado';
  if (status === 'lost') return 'Perdido';
  return 'Elegível';
}

export function buildPartnerFreeMonthlyView(input: {
  activeCount: number;
  paymentDueDate?: string | null;
  history?: PartnerFreeMonthlyHistoryRow[];
}): PartnerFreeMonthlyView {
  const activeCount = Math.max(0, Math.floor(input.activeCount));
  const targetCount = PARTNER_REFERRAL_FREE_ACTIVE_THRESHOLD;
  const history = input.history || [];
  const currentMonthKey = getBrazilMonthKey();
  const isEligible = activeCount >= targetCount;

  const currentMonthRecord = history.find(
    (row) => getBrazilMonthKey(new Date(row.referenceMonth)) === currentMonthKey
  );
  const appliedThisMonth = currentMonthRecord?.status === 'applied';

  const previousRecords = history.filter(
    (row) => getBrazilMonthKey(new Date(row.referenceMonth)) !== currentMonthKey
  );
  const hadAppliedBefore = previousRecords.some((row) => row.status === 'applied');
  const lostBenefitHint = hadAppliedBefore && activeCount < targetCount && !appliedThisMonth;

  const isActiveBenefit = isEligible;
  const isProtectedThisCycle = isEligible || appliedThisMonth;

  let statusLabel = 'Inativa';
  let statusTone: PartnerFreeMonthlyView['statusTone'] = 'inactive';
  if (lostBenefitHint) {
    statusLabel = 'Benefício perdido neste ciclo';
    statusTone = 'lost';
  } else if (appliedThisMonth) {
    statusLabel = 'Grátis aplicada pelo admin (mês atual)';
    statusTone = 'active';
  } else if (isEligible) {
    statusLabel = 'Elegível — aguardando aplicação manual';
    statusTone = 'active';
  } else if (activeCount > 0) {
    statusLabel = 'Em progresso';
    statusTone = 'progress';
  }

  let protectionMessage =
    'Mensalidade grátis inativa. Mantenha 3 indicados ativos para elegibilidade.';
  if (appliedThisMonth) {
    protectionMessage =
      '✅ Mensalidade grátis registrada para este mês pelo Agendei Fácil. Isso não altera cobrança automática ainda — controle manual.';
  } else if (isEligible) {
    protectionMessage =
      '✅ Você tem 3+ indicados ativos e está protegido pela regra de mensalidade grátis. O admin pode aplicar manualmente neste mês.';
  } else if (lostBenefitHint) {
    protectionMessage =
      '⚠️ Você perdeu a elegibilidade (menos de 3 indicados ativos). Recupere 3 ativos para voltar a ter mensalidade grátis no próximo ciclo.';
  } else if (activeCount > 0) {
    protectionMessage = `Faltam ${targetCount - activeCount} indicado${targetCount - activeCount === 1 ? '' : 's'} ativo${targetCount - activeCount === 1 ? '' : 's'} para desbloquear a mensalidade grátis.`;
  }

  let adminListBadge = 'Sem elegibilidade';
  let adminListBadgeTone: PartnerFreeMonthlyView['adminListBadgeTone'] = 'neutral';
  if (appliedThisMonth) {
    adminListBadge = 'Grátis aplicada';
    adminListBadgeTone = 'active';
  } else if (isEligible) {
    adminListBadge = 'Grátis elegível';
    adminListBadgeTone = 'active';
  } else if (lostBenefitHint) {
    adminListBadge = 'Perdeu benefício';
    adminListBadgeTone = 'lost';
  } else if (activeCount > 0) {
    adminListBadge = `Perto ${activeCount}/${targetCount}`;
    adminListBadgeTone = 'progress';
  }

  return {
    isEligible,
    isActiveBenefit,
    isProtectedThisCycle,
    appliedThisMonth,
    lostBenefitHint,
    activeCount,
    targetCount,
    progressLabel: `${activeCount}/${targetCount}`,
    statusLabel,
    statusTone,
    protectionMessage,
    nextDueDateLabel: formatPartnerPaymentDueDate(input.paymentDueDate),
    adminListBadge,
    adminListBadgeTone,
  };
}

export function buildPartnerFreeMonthlyViewFromSummary(
  summary: PartnerReferralsDashboardSummary,
  paymentDueDate?: string | null,
  history?: PartnerFreeMonthlyHistoryRow[]
): PartnerFreeMonthlyView {
  return buildPartnerFreeMonthlyView({
    activeCount: summary.activeCount,
    paymentDueDate,
    history,
  });
}

export async function fetchPartnerEstablishmentPaymentDueDate(
  establishmentId: string
): Promise<string | null> {
  const id = String(establishmentId || '').trim();
  if (!id) return null;
  try {
    const { data, error } = await supabase
      .from('establishments')
      .select('payment_due_date')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data?.payment_due_date ? String(data.payment_due_date) : null;
  } catch {
    return null;
  }
}

export async function fetchPartnerFreeMonthlyHistory(
  partnerEstablishmentId: string
): Promise<{ ok: boolean; items: PartnerFreeMonthlyHistoryRow[]; error?: string }> {
  const id = String(partnerEstablishmentId || '').trim();
  if (!id) return { ok: false, items: [], error: 'Estabelecimento não informado.' };

  try {
    const { data, error } = await supabase.rpc('list_partner_free_monthly_history', {
      p_partner_establishment_id: id,
    });
    if (error) {
      if (isMissingFreeMonthlyTableError(error)) return { ok: true, items: [] };
      throw error;
    }
    const payload = (data || {}) as { ok?: boolean; items?: any[]; error?: string };
    if (payload.ok === false && payload.error === 'missing_table') return { ok: true, items: [] };
    const items = (Array.isArray(payload.items) ? payload.items : []).map(mapHistoryRow);
    return { ok: true, items };
  } catch (error: any) {
    if (isMissingFreeMonthlyTableError(error)) return { ok: true, items: [] };
    return { ok: false, items: [], error: error?.message || 'Erro ao carregar histórico.' };
  }
}

export async function adminUpsertPartnerFreeMonthly(input: {
  partnerEstablishmentId: string;
  status: PartnerFreeMonthlyRecordStatus;
  notes?: string;
}): Promise<{ ok: boolean; message?: string; record?: PartnerFreeMonthlyHistoryRow; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('admin_upsert_partner_free_monthly', {
      p_partner_establishment_id: input.partnerEstablishmentId,
      p_status: input.status,
      p_notes: input.notes || null,
    });
    if (error) throw error;

    const payload = (data || {}) as { ok?: boolean; error?: string; message?: string; record?: any };
    if (!payload.ok) {
      return {
        ok: false,
        error: payload.error,
        message: payload.message || 'Não foi possível registrar mensalidade grátis.',
      };
    }

    const statusMessages: Record<PartnerFreeMonthlyRecordStatus, string> = {
      applied: 'Mensalidade grátis marcada para este mês (registro manual — sem alterar cobrança automática).',
      lost: 'Perda do benefício registrada para este mês.',
      eligible: 'Elegibilidade registrada para este mês.',
    };

    return {
      ok: true,
      message: statusMessages[input.status],
      record: payload.record
        ? {
            id: String(payload.record.id),
            partnerEstablishmentId: input.partnerEstablishmentId,
            referenceMonth: String(payload.record.reference_month || ''),
            activeReferralsCount: Number(payload.record.active_referrals_count || 0),
            status: String(payload.record.status) as PartnerFreeMonthlyRecordStatus,
            appliedAt: payload.record.applied_at ? String(payload.record.applied_at) : null,
            notes: payload.record.notes ? String(payload.record.notes) : null,
          }
        : undefined,
    };
  } catch (error: any) {
    return { ok: false, message: error?.message || 'Erro ao registrar mensalidade grátis.' };
  }
}
