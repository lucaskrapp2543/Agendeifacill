import type { SupabaseClient } from '@supabase/supabase-js';
import { recordAdminMpCommission } from './adminMpCommission';

/**
 * Confirma agendamento em `pending_payment` usando external_reference/metadata do pagamento MP,
 * quando a linha ainda não tem (ou o webhook não encontrou) payment_transaction_id.
 */
export async function confirmPendingAppointmentFromMpPaymentMetadata(
  admin: SupabaseClient,
  paymentIdStr: string,
  payment: any
): Promise<{ ok: true; appointmentId: string } | { ok: false }> {
  const st = String(payment?.status || '').toLowerCase();
  if (st !== 'approved' && st !== 'authorized') return { ok: false };

  const ext = String(payment?.external_reference || '').trim();
  const meta = payment?.metadata || {};
  const metaAid = String(meta?.appointment_id ?? meta?.appointmentId ?? '').trim();

  let appointmentId = '';
  if (ext.startsWith('appointment_')) {
    appointmentId = ext.slice('appointment_'.length).trim();
  } else if (/^[0-9a-f-]{36}$/i.test(ext)) {
    appointmentId = ext;
  } else if (/^[0-9a-f-]{36}$/i.test(metaAid)) {
    appointmentId = metaAid;
  }
  if (!appointmentId) return { ok: false };

  const { data: aptRows, error } = await admin
    .from('appointments')
    .select('id, establishment_id, status')
    .eq('id', appointmentId)
    .limit(1);

  if (error || !aptRows?.[0]) return { ok: false };
  const apt = aptRows[0] as { id: string; establishment_id?: string | null; status?: string };
  if (String(apt.status || '') !== 'pending_payment') return { ok: false };

  const paymentMethodId = String(payment.payment_method_id || '').toLowerCase();
  let paymentMethod = 'pix';
  if (paymentMethodId === 'credit_card') paymentMethod = 'credito';
  else if (paymentMethodId === 'debit_card') paymentMethod = 'debito';
  else if (paymentMethodId === 'pix') paymentMethod = 'pix';

  const { error: updErr } = await admin
    .from('appointments')
    .update({
      status: 'confirmed',
      payment_status: 'paid',
      payment_transaction_id: paymentIdStr,
      payment_method: paymentMethod,
      pix_payment_status: paymentMethodId === 'pix' ? 'aprovado' : null,
    } as any)
    .eq('id', apt.id);

  if (updErr) {
    console.error('❌ [MP] Erro ao confirmar agendamento (metadata/external_reference):', updErr);
    return { ok: false };
  }

  console.log('✅ [MP] Agendamento confirmado via external_reference/metadata', {
    appointmentId: apt.id,
    paymentId: paymentIdStr,
  });

  await recordAdminMpCommission(admin, {
    establishmentId: String(apt.establishment_id || ''),
    sourceType: 'appointment',
    sourceId: String(apt.id),
    paymentId: paymentIdStr,
    externalReference: ext || null,
    paymentMethod,
    grossAmountCents: Math.round(Number(payment?.transaction_amount || 0) * 100) || null,
    paidAt: String(payment?.date_approved || payment?.date_created || '') || null,
    metadata: {
      origin: 'confirm_appointment_from_mp_metadata',
      payment_status: payment?.status || null,
      payment_method_id: payment?.payment_method_id || null,
    },
  });
  return { ok: true, appointmentId: String(apt.id) };
}
