import type { SupabaseClient } from '@supabase/supabase-js';
import { isOnlinePaymentOptionalForEstablishment } from './establishmentPaymentFlags';

/**
 * Reservas `pending_payment` SEM transação (o cliente nunca iniciou o pagamento) há mais
 * de X minutos. Regra única usada pelas limpezas do SERVIDOR (Render e função Netlify):
 *
 *   · barbearia com pagamento online OPCIONAL -> vira "pagar no local" (status 'pending'),
 *     o horário continua do cliente e ele NÃO recebe "não recebemos seu pagamento";
 *   · barbearia com pagamento OBRIGATÓRIO      -> cancela como sempre (libera o horário);
 *   · cliente marcado como "pagamento obrigatório" (manual_clients.force_advance_payment)
 *     -> cancela, mesmo em barbearia opcional (o dono pediu para esse cliente pagar antes).
 *
 * Conversão é UMA POR VEZ: o trigger de conflito de horário revalida no UPDATE para
 * 'pending' — se ele recusar uma reserva (horário bloqueado / encaixe por cima), só ela
 * é cancelada; o resto do lote segue. As limpezas do NAVEGADOR não convertem (não
 * enxergam manual_clients): só cancelam reservas de barbearias obrigatórias.
 */

const EST_COLUMNS_FULL =
  'id,has_mercadopago,mercadopago_access_token,mercadopago_health,pagarme_recipient_id,exigir_pagamento_antecipado_mercadopago,pagamento_adiantado_opcional_mercadopago,exigir_pagamento_antecipado,pagamento_adiantado_opcional,online_payment_blocked_by_admin';
// Banco antigo sem as colunas novas: as funções tratam ausência como "comportamento antigo".
const EST_COLUMNS_BASE =
  'id,mercadopago_access_token,pagarme_recipient_id,exigir_pagamento_antecipado_mercadopago,pagamento_adiantado_opcional_mercadopago,exigir_pagamento_antecipado,pagamento_adiantado_opcional';

const phoneKey = (raw: unknown): string => {
  const digits = String(raw || '').replace(/\D/g, '');
  return digits.length >= 8 ? digits.slice(-9) : '';
};

export async function settleStalePendingPaymentsWithoutTx(
  supabase: SupabaseClient,
  params: { thresholdIso: string; cancelDetail: string; log?: (message: string, extra?: unknown) => void }
): Promise<{ converted: number; cancelled: number }> {
  const log = params.log || (() => {});

  const { data: stale, error: staleError } = await supabase
    .from('appointments')
    .select('id,establishment_id,client_whatsapp')
    .eq('status', 'pending_payment')
    .is('payment_transaction_id', null)
    .lt('created_at', params.thresholdIso)
    .limit(1000);
  if (staleError) {
    log('⚠️ Limpeza: falha ao listar reservas sem pagamento', staleError.message);
    return { converted: 0, cancelled: 0 };
  }
  const rows = (stale || []) as Array<{ id: string; establishment_id: string | null; client_whatsapp: string | null }>;
  if (rows.length === 0) return { converted: 0, cancelled: 0 };

  const estIds = Array.from(new Set(rows.map((r) => String(r.establishment_id || '')).filter(Boolean)));

  // Regras de pagamento de cada barbearia
  const estById = new Map<string, any>();
  let estRes: { data: any[] | null; error: { message: string } | null } = await supabase
    .from('establishments')
    .select(EST_COLUMNS_FULL)
    .in('id', estIds);
  if (estRes.error) {
    log('⚠️ Limpeza: select de establishments falhou, tentando sem colunas novas', estRes.error.message);
    estRes = await supabase.from('establishments').select(EST_COLUMNS_BASE).in('id', estIds);
  }
  if (estRes.error) {
    log('⚠️ Limpeza: não consegui ler as barbearias — mantendo comportamento antigo (cancelar)', estRes.error.message);
  }
  for (const e of (estRes.data || []) as any[]) estById.set(String(e.id), e);

  // Clientes com "pagamento obrigatório" individual (por barbearia + final do telefone)
  const forced = new Set<string>();
  const forcedRes = await supabase
    .from('manual_clients')
    .select('establishment_id,whatsapp')
    .in('establishment_id', estIds)
    .eq('force_advance_payment', true);
  if (forcedRes.error) {
    log('⚠️ Limpeza: não consegui ler clientes com pagamento obrigatório', forcedRes.error.message);
  }
  for (const m of (forcedRes.data || []) as any[]) {
    const key = phoneKey(m?.whatsapp);
    if (key) forced.add(`${m.establishment_id}::${key}`);
  }

  const toCancel: string[] = [];
  let converted = 0;
  for (const row of rows) {
    const est = estById.get(String(row.establishment_id || ''));
    const isForced = forced.has(`${row.establishment_id}::${phoneKey(row.client_whatsapp)}`);
    if (!est || isForced || !isOnlinePaymentOptionalForEstablishment(est)) {
      toCancel.push(row.id);
      continue;
    }
    const { data: conv, error: convError } = await supabase
      .from('appointments')
      .update({ status: 'pending', payment_method: 'pagar_local', payment_status: 'pending' } as any)
      .eq('id', row.id)
      .eq('status', 'pending_payment')
      .select('id');
    if (convError) {
      // Ex.: trigger de conflito (horário bloqueado / encaixe por cima): libera o horário.
      log('⚠️ Limpeza: não deu para manter como "pagar no local", cancelando', { id: row.id, error: convError.message });
      toCancel.push(row.id);
      continue;
    }
    converted += conv?.length || 0;
  }

  let cancelled = 0;
  if (toCancel.length > 0) {
    const { data: canc, error: cancError } = await supabase
      .from('appointments')
      .update({
        status: 'cancelled',
        payment_status: 'failed',
        cancellation_source: 'system_abandoned_checkout',
        cancellation_detail: params.cancelDetail,
      } as any)
      .in('id', toCancel)
      .eq('status', 'pending_payment')
      .select('id');
    if (cancError) log('⚠️ Limpeza: falha ao cancelar reservas sem pagamento', cancError.message);
    cancelled = canc?.length || 0;
  }

  return { converted, cancelled };
}
