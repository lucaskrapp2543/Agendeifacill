import type { SupabaseClient } from '@supabase/supabase-js';

/** Reserva sem iniciar pagamento (sem payment_transaction_id). */
export const PENDING_PAYMENT_NO_TX_MINUTES = 15;

/**
 * Reserva com pagamento iniciado (há transaction_id) mas não confirmada no app.
 * Antes era 24h — muitos barbeiros interpretam como "cliente cancelou".
 * 12h mantém margem para webhook/polling atrasado e ainda fecha antes do "dia seguinte".
 */
export const PENDING_PAYMENT_WITH_TX_MINUTES = 12 * 60;

export const CANCELLATION_SOURCE = {
  CLIENT: 'client',
  ESTABLISHMENT_STAFF: 'establishment_staff',
  /**
   * Horário antigo cancelado APENAS porque o agendamento foi remarcado/transferido para
   * outro horário/dia. O scheduler do WhatsApp reconhece este motivo e NÃO envia a mensagem
   * de "agendamento cancelado" (que assustava o cliente numa simples troca de horário).
   */
  RESCHEDULED: 'rescheduled_by_staff',
  SYSTEM_ABANDONED_CHECKOUT: 'system_abandoned_checkout',
  SYSTEM_PAYMENT_TIMEOUT: 'system_payment_timeout',
  PAYMENT_REJECTED: 'payment_rejected',
  UNKNOWN: 'unknown',
} as const;

export type CancellationSource = (typeof CANCELLATION_SOURCE)[keyof typeof CANCELLATION_SOURCE];

export function buildStalePaymentDetail(kind: 'no_tx' | 'with_tx'): string {
  if (kind === 'no_tx') {
    return `Limpeza automática: pagamento obrigatório não iniciado (sem ID de transação) por mais de ${PENDING_PAYMENT_NO_TX_MINUTES} min.`;
  }
  const h = Math.round(PENDING_PAYMENT_WITH_TX_MINUTES / 60);
  return `Limpeza automática: pagamento iniciado mas não confirmado no sistema por mais de ${PENDING_PAYMENT_WITH_TX_MINUTES} min (~${h}h). Conferir Mercado Pago se o cliente enviar comprovante.`;
}

export function describeCancellationSourcePt(src: string | null | undefined): string {
  const s = String(src || '').trim().toLowerCase();
  switch (s) {
    case CANCELLATION_SOURCE.CLIENT:
      return 'Cliente (app / link público)';
    case CANCELLATION_SOURCE.ESTABLISHMENT_STAFF:
      return 'Estabelecimento (painel interno)';
    case CANCELLATION_SOURCE.RESCHEDULED:
      return 'Remarcado/transferido para outro horário';
    case CANCELLATION_SOURCE.SYSTEM_ABANDONED_CHECKOUT:
      return 'Sistema — pagamento não iniciado no prazo';
    case CANCELLATION_SOURCE.SYSTEM_PAYMENT_TIMEOUT:
      return 'Sistema — pagamento não confirmado no prazo';
    case CANCELLATION_SOURCE.PAYMENT_REJECTED:
      return 'Pagamento recusado / cancelado no fluxo';
    case CANCELLATION_SOURCE.UNKNOWN:
    default:
      return s ? `Outro (${s})` : 'Não informado (notificação antiga ou fluxo externo)';
  }
}

/** Atualiza cancelamento com origem; se colunas novas não existirem (42703), repete só status/pagamento. */
export async function updateAppointmentCancelledWithSource(
  supabase: SupabaseClient,
  filter: { id: string } | { ids: string[] },
  patch: {
    cancellation_source: string;
    cancellation_detail?: string | null;
    /** Se omitido, não altera payment_status (ex.: cancelamento manual de agendamento já confirmado). */
    payment_status?: string | null;
  }
): Promise<{ error: Error | null }> {
  const base: Record<string, unknown> = {
    status: 'cancelled',
    cancellation_source: patch.cancellation_source,
    cancellation_detail: patch.cancellation_detail ?? null,
  };
  if (patch.payment_status !== undefined && patch.payment_status !== null) {
    base.payment_status = patch.payment_status;
  }

  const run = async (payload: Record<string, unknown>) => {
    if ('id' in filter) {
      return supabase.from('appointments').update(payload as any).eq('id', filter.id);
    }
    return supabase.from('appointments').update(payload as any).in('id', filter.ids);
  };

  let { error } = await run(base);
  if (error && String((error as any).code || '') === '42703') {
    const lean: Record<string, unknown> = { status: 'cancelled' };
    if (patch.payment_status !== undefined && patch.payment_status !== null) {
      lean.payment_status = patch.payment_status;
    }
    ({ error } = await run(lean));
  }

  return { error: error ? (error as Error) : null };
}
