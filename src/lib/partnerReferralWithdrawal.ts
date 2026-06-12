import { supabase } from './supabase';
import { formatPartnerReferralMoney, PARTNER_REFERRAL_COMMISSION_BRL, PARTNER_REFERRAL_FREE_ACTIVE_THRESHOLD } from './partnerReferralDashboard';

export type PartnerWithdrawalStatus = 'pending' | 'paid' | 'cancelled';

export type PartnerWithdrawalRequestRow = {
  id: string;
  partnerEstablishmentId: string;
  amountCents: number;
  status: PartnerWithdrawalStatus;
  requestedAt: string;
  paidAt?: string | null;
  paidBy?: string | null;
  notes?: string | null;
};

const SP_TIMEZONE = 'America/Sao_Paulo';

export function getBrazilTodayParts() {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: SP_TIMEZONE,
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  });
  const parts = formatter.formatToParts(new Date());
  const day = Number(parts.find((part) => part.type === 'day')?.value || 0);
  const month = Number(parts.find((part) => part.type === 'month')?.value || 0);
  const year = Number(parts.find((part) => part.type === 'year')?.value || 0);
  return { day, month, year };
}

export function isPartnerWithdrawalDayAvailable(): boolean {
  return getBrazilTodayParts().day === 5;
}

export function getPartnerWithdrawalDayMessage(): string {
  return isPartnerWithdrawalDayAvailable()
    ? 'Hoje você pode solicitar saque.'
    : 'Os saques ficam disponíveis todo dia 5.';
}

export function computeWithdrawalAmountCentsFromActiveCount(activeCount: number): number {
  return Math.max(0, activeCount - PARTNER_REFERRAL_FREE_ACTIVE_THRESHOLD) * PARTNER_REFERRAL_COMMISSION_BRL * 100;
}

export function formatWithdrawalAmountFromCents(amountCents: number): string {
  return formatPartnerReferralMoney(amountCents / 100);
}

function mapWithdrawalRow(raw: any): PartnerWithdrawalRequestRow {
  return {
    id: String(raw.id),
    partnerEstablishmentId: String(raw.partner_establishment_id),
    amountCents: Number(raw.amount_cents || 0),
    status: String(raw.status || 'pending') as PartnerWithdrawalStatus,
    requestedAt: String(raw.requested_at || ''),
    paidAt: raw.paid_at ? String(raw.paid_at) : null,
    paidBy: raw.paid_by ? String(raw.paid_by) : null,
    notes: raw.notes ? String(raw.notes) : null,
  };
}

function isMissingWithdrawalTableError(error: unknown): boolean {
  const msg = String((error as any)?.message || '').toLowerCase();
  const code = String((error as any)?.code || '');
  return (
    code === '42883' ||
    code === 'PGRST202' ||
    msg.includes('partner_withdrawal') ||
    (msg.includes('does not exist') && msg.includes('withdrawal'))
  );
}

export function hasBlockingWithdrawalThisMonth(
  requests: PartnerWithdrawalRequestRow[],
  referenceDate = new Date()
): boolean {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: SP_TIMEZONE,
    month: 'numeric',
    year: 'numeric',
  });
  const current = formatter.format(referenceDate);
  return requests.some((request) => {
    if (!['pending', 'paid'].includes(request.status)) return false;
    const requested = new Date(request.requestedAt);
    if (!Number.isFinite(requested.getTime())) return false;
    return formatter.format(requested) === current;
  });
}

export async function fetchPartnerWithdrawalRequests(
  partnerEstablishmentId: string
): Promise<{ ok: boolean; items: PartnerWithdrawalRequestRow[]; error?: string }> {
  const id = String(partnerEstablishmentId || '').trim();
  if (!id) return { ok: false, items: [], error: 'Estabelecimento não informado.' };

  try {
    const { data, error } = await supabase.rpc('list_partner_withdrawal_requests', {
      p_partner_establishment_id: id,
    });
    if (error) {
      if (isMissingWithdrawalTableError(error)) {
        return { ok: true, items: [] };
      }
      throw error;
    }
    const payload = (data || {}) as { ok?: boolean; items?: any[]; error?: string };
    if (payload.ok === false && payload.error === 'missing_table') {
      return { ok: true, items: [] };
    }
    const items = (Array.isArray(payload.items) ? payload.items : []).map(mapWithdrawalRow);
    return { ok: true, items };
  } catch (error: any) {
    if (isMissingWithdrawalTableError(error)) {
      return { ok: true, items: [] };
    }
    return { ok: false, items: [], error: error?.message || 'Erro ao carregar saques.' };
  }
}

export async function requestPartnerWithdrawal(partnerEstablishmentId: string): Promise<{
  ok: boolean;
  message?: string;
  request?: PartnerWithdrawalRequestRow;
  error?: string;
}> {
  const id = String(partnerEstablishmentId || '').trim();
  if (!id) return { ok: false, error: 'Estabelecimento não informado.' };

  try {
    const { data, error } = await supabase.rpc('request_partner_withdrawal', {
      p_partner_establishment_id: id,
    });
    if (error) {
      if (isMissingWithdrawalTableError(error)) {
        return { ok: false, message: 'Sistema de saque ainda não está disponível. Tente novamente em instantes.' };
      }
      throw error;
    }

    const payload = (data || {}) as {
      ok?: boolean;
      error?: string;
      message?: string;
      request?: any;
    };

    if (!payload.ok) {
      return {
        ok: false,
        error: payload.error,
        message: payload.message || 'Não foi possível solicitar saque.',
      };
    }

    return {
      ok: true,
      message:
        'Solicitação enviada com sucesso. O Agendei Fácil irá analisar e realizar o pagamento via Pix.',
      request: payload.request ? mapWithdrawalRow(payload.request) : undefined,
    };
  } catch (error: any) {
    return { ok: false, message: error?.message || 'Erro ao solicitar saque.' };
  }
}

export async function adminUpdatePartnerWithdrawalRequest(input: {
  requestId: string;
  action: 'paid' | 'cancel';
  notes?: string;
}): Promise<{ ok: boolean; message?: string; request?: PartnerWithdrawalRequestRow; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('admin_update_partner_withdrawal_request', {
      p_request_id: input.requestId,
      p_action: input.action,
      p_notes: input.notes || null,
    });
    if (error) throw error;

    const payload = (data || {}) as { ok?: boolean; error?: string; message?: string; request?: any };
    if (!payload.ok) {
      return {
        ok: false,
        error: payload.error,
        message: payload.message || 'Não foi possível atualizar a solicitação.',
      };
    }

    return {
      ok: true,
      message: input.action === 'paid' ? 'Solicitação marcada como paga.' : 'Solicitação cancelada.',
      request: payload.request ? mapWithdrawalRow(payload.request) : undefined,
    };
  } catch (error: any) {
    return { ok: false, message: error?.message || 'Erro ao atualizar solicitação.' };
  }
}

export function getWithdrawalStatusLabel(status: PartnerWithdrawalStatus): string {
  if (status === 'paid') return 'Pago';
  if (status === 'cancelled') return 'Cancelado';
  return 'Pendente';
}
