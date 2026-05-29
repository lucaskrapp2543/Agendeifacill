import type { SupabaseClient } from '@supabase/supabase-js';
import { refreshAccessToken } from './mp-oauth';
import { checkMPPaymentStatus } from './mp-service';
import { recordAdminMpCommission } from './adminMpCommission';

export type ReconcileMpPendingResult = {
  checked: number;
  updated: number;
  skippedNoToken: boolean;
  errors: string[];
};

async function getValidMercadoPagoAccessTokenForEstablishment(
  supabaseAdmin: SupabaseClient,
  establishmentId: string
): Promise<string | null> {
  const { data: establishment, error } = await supabaseAdmin
    .from('establishments')
    .select('mercadopago_access_token, mercadopago_refresh_token, mercadopago_token_expires_at')
    .eq('id', establishmentId)
    .single();

  if (error || !establishment) return null;

  const accessToken = String((establishment as any)?.mercadopago_access_token || '').trim();
  const refreshToken = String((establishment as any)?.mercadopago_refresh_token || '').trim();
  const expiresAtRaw = (establishment as any)?.mercadopago_token_expires_at as string | null | undefined;

  if (!accessToken) return null;
  if (!expiresAtRaw) return accessToken;

  const expiresAt = new Date(expiresAtRaw);
  const now = Date.now();
  const safetyMs = 2 * 60 * 1000;
  if (Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() > now + safetyMs) {
    return accessToken;
  }

  if (!refreshToken) return null;

  try {
    const refreshed = await refreshAccessToken(refreshToken);
    const newAccessToken = String(refreshed.access_token || '').trim();
    const newRefreshToken = String(refreshed.refresh_token || refreshToken).trim();
    const expiresIn = Number(refreshed.expires_in || 21600);
    const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    if (!newAccessToken) return null;

    await supabaseAdmin
      .from('establishments')
      .update({
        mercadopago_access_token: newAccessToken,
        mercadopago_refresh_token: newRefreshToken,
        mercadopago_token_expires_at: newExpiresAt,
      } as any)
      .eq('id', establishmentId);

    return newAccessToken;
  } catch {
    return null;
  }
}

/**
 * Consulta o Mercado Pago para agendamentos ainda em `pending_payment` com transaction_id
 * e promove para confirmed/paid quando o MP já aprovou — roda antes da limpeza automática.
 */
export async function reconcilePendingMercadoPagoAppointments(
  supabaseAdmin: SupabaseClient,
  establishmentId: string,
  options?: { maxRows?: number; lookbackDays?: number }
): Promise<ReconcileMpPendingResult> {
  const errors: string[] = [];
  const maxRows = Math.min(50, Math.max(1, options?.maxRows ?? 25));
  const lookbackDays = Math.min(30, Math.max(1, options?.lookbackDays ?? 14));
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();

  const accessToken = await getValidMercadoPagoAccessTokenForEstablishment(supabaseAdmin, establishmentId);
  if (!accessToken) {
    return { checked: 0, updated: 0, skippedNoToken: true, errors: [] };
  }

  const { data: rows, error: qErr } = await supabaseAdmin
    .from('appointments')
    .select('id, payment_transaction_id, payment_status, pix_payment_status, status')
    .eq('establishment_id', establishmentId)
    .eq('status', 'pending_payment')
    .not('payment_transaction_id', 'is', null)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(maxRows * 3);

  if (qErr) {
    errors.push(String((qErr as any)?.message || qErr));
    return { checked: 0, updated: 0, skippedNoToken: false, errors };
  }

  const list = Array.isArray(rows) ? rows : [];
  const candidates = list
    .filter((r: any) => {
      const ps = String(r?.payment_status || '').toLowerCase();
      const px = String(r?.pix_payment_status || '').toLowerCase();
      if (ps === 'paid') return false;
      if (px === 'confirmado' || px === 'aprovado') return false;
      return true;
    })
    .slice(0, maxRows);

  let updated = 0;
  for (const row of candidates) {
    const pid = String(row?.payment_transaction_id || '').trim();
    const id = String(row?.id || '').trim();
    if (!pid || !id) continue;
    const numId = Number(pid);
    if (!Number.isFinite(numId) || numId <= 0) {
      errors.push(`ID de transação inválido para agendamento ${id}`);
      continue;
    }
    try {
      const payment = await checkMPPaymentStatus(numId, accessToken);
      const st = String(payment?.status || '').toLowerCase();
      if (st !== 'approved' && st !== 'authorized') continue;

      const paymentMethodId = String(payment.payment_method_id || '').toLowerCase();
      let paymentMethod = 'pix';
      if (paymentMethodId === 'credit_card') paymentMethod = 'credito';
      else if (paymentMethodId === 'debit_card') paymentMethod = 'debito';
      else if (paymentMethodId === 'pix') paymentMethod = 'pix';

      const { error: updErr } = await supabaseAdmin
        .from('appointments')
        .update({
          status: 'confirmed',
          payment_status: 'paid',
          payment_transaction_id: String(pid),
          payment_method: paymentMethod,
          pix_payment_status: paymentMethodId === 'pix' ? 'confirmado' : null,
        } as any)
        .eq('id', id)
        .eq('status', 'pending_payment');

      if (updErr) {
        errors.push(`${id}: ${String((updErr as any)?.message || updErr)}`);
      } else {
        updated += 1;
        await recordAdminMpCommission(supabaseAdmin, {
          establishmentId,
          sourceType: 'appointment',
          sourceId: id,
          paymentId: String(pid),
          externalReference: String((payment as any)?.external_reference || '') || null,
          paymentMethod,
          grossAmountCents: Math.round(Number((payment as any)?.transaction_amount || 0) * 100) || null,
          paidAt: String((payment as any)?.date_approved || (payment as any)?.date_created || '') || null,
          metadata: {
            origin: 'reconcile_pending_appointments',
            payment_status: (payment as any)?.status || null,
            payment_method_id: (payment as any)?.payment_method_id || null,
          },
        });
      }
    } catch (e: any) {
      errors.push(`${id}: ${String(e?.message || e)}`);
    }
  }

  return {
    checked: candidates.length,
    updated,
    skippedNoToken: false,
    errors,
  };
}
