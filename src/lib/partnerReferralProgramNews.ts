import { supabase } from './supabase';

export type PartnerReferralNotificationType =
  | 'new_referral'
  | 'free_monthly_unlocked'
  | 'started_earning'
  | 'referral_inactive';

export type PartnerReferralNotificationRow = {
  id: string;
  notificationType: PartnerReferralNotificationType;
  title: string;
  message: string;
  isRead: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
};

function mapNotificationRow(raw: any): PartnerReferralNotificationRow {
  return {
    id: String(raw.id),
    notificationType: String(raw.notification_type || 'new_referral') as PartnerReferralNotificationType,
    title: String(raw.title || ''),
    message: String(raw.message || ''),
    isRead: Boolean(raw.is_read),
    metadata: (raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : {}) as Record<string, unknown>,
    createdAt: String(raw.created_at || ''),
  };
}

function isMissingProgramNotificationsError(error: unknown): boolean {
  const msg = String((error as any)?.message || '').toLowerCase();
  const code = String((error as any)?.code || '');
  return (
    code === '42883' ||
    code === 'PGRST202' ||
    msg.includes('partner_referral_notifications') ||
    (msg.includes('does not exist') && msg.includes('referral_notification'))
  );
}

export function formatPartnerReferralNotificationDate(value?: string | null): string {
  const raw = String(value || '').trim();
  if (!raw) return '—';
  const dt = new Date(raw);
  if (!Number.isFinite(dt.getTime())) return '—';
  return dt.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export async function fetchPartnerReferralProgramNews(
  partnerEstablishmentId: string,
  limit = 20
): Promise<{
  ok: boolean;
  items: PartnerReferralNotificationRow[];
  unreadCount: number;
  error?: string;
}> {
  const id = String(partnerEstablishmentId || '').trim();
  if (!id) return { ok: false, items: [], unreadCount: 0, error: 'Estabelecimento não informado.' };

  try {
    const { data, error } = await supabase.rpc('list_partner_referral_notifications', {
      p_partner_establishment_id: id,
      p_limit: limit,
    });
    if (error) {
      if (isMissingProgramNotificationsError(error)) {
        return { ok: true, items: [], unreadCount: 0 };
      }
      throw error;
    }

    const payload = (data || {}) as {
      ok?: boolean;
      error?: string;
      items?: any[];
      unread_count?: number;
    };

    if (payload.ok === false && payload.error === 'forbidden') {
      return { ok: false, items: [], unreadCount: 0, error: 'Acesso negado.' };
    }

    const items = (Array.isArray(payload.items) ? payload.items : []).map(mapNotificationRow);
    return {
      ok: true,
      items,
      unreadCount: Number(payload.unread_count || 0),
    };
  } catch (error: any) {
    if (isMissingProgramNotificationsError(error)) {
      return { ok: true, items: [], unreadCount: 0 };
    }
    return { ok: false, items: [], unreadCount: 0, error: error?.message || 'Erro ao carregar novidades.' };
  }
}

export async function markPartnerReferralProgramNewsRead(
  partnerEstablishmentId: string,
  notificationIds?: string[]
): Promise<{ ok: boolean; error?: string }> {
  const id = String(partnerEstablishmentId || '').trim();
  if (!id) return { ok: false, error: 'Estabelecimento não informado.' };

  try {
    const { data, error } = await supabase.rpc('mark_partner_referral_notifications_read', {
      p_partner_establishment_id: id,
      p_notification_ids: notificationIds?.length ? notificationIds : null,
    });
    if (error) throw error;
    const payload = (data || {}) as { ok?: boolean; error?: string };
    if (!payload.ok) return { ok: false, error: payload.error || 'Não foi possível marcar como lida.' };
    return { ok: true };
  } catch (error: any) {
    if (isMissingProgramNotificationsError(error)) return { ok: true };
    return { ok: false, error: error?.message || 'Erro ao marcar novidades.' };
  }
}
