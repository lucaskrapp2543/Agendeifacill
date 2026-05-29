import type { SupabaseClient } from '@supabase/supabase-js';

export type AdminMpCommissionSourceType = 'appointment' | 'subscription';
export type AdminMpCommissionPaymentMethod = 'pix' | 'credito';

type RecordAdminMpCommissionInput = {
  establishmentId: string;
  sourceType: AdminMpCommissionSourceType;
  sourceId?: string | null;
  paymentId?: string | null;
  externalReference?: string | null;
  paymentMethod?: string | null;
  grossAmountCents?: number | null;
  paidAt?: string | null;
  metadata?: Record<string, any>;
};

const normalizePaymentMethod = (raw?: string | null): AdminMpCommissionPaymentMethod => {
  const value = String(raw || '').toLowerCase().trim();
  if (value.includes('pix')) return 'pix';
  return 'credito';
};

const buildSourceKey = (input: RecordAdminMpCommissionInput) => {
  const sourceType = input.sourceType;
  const paymentId = String(input.paymentId || '').trim();
  if (paymentId) return `${sourceType}:payment:${paymentId}`;

  const externalReference = String(input.externalReference || '').trim();
  if (externalReference) return `${sourceType}:external:${externalReference}`;

  const sourceId = String(input.sourceId || '').trim();
  if (sourceId) return `${sourceType}:source:${sourceId}`;

  return '';
};

const isMissingCommissionTableError = (error: any) => {
  const msg = String(error?.message || error || '').toLowerCase();
  return (
    msg.includes('admin_mp_commissions') ||
    msg.includes('relation') ||
    msg.includes('does not exist') ||
    msg.includes('schema cache')
  );
};

export async function recordAdminMpCommission(
  supabaseAdmin: SupabaseClient | any,
  input: RecordAdminMpCommissionInput
): Promise<{ ok: boolean; skipped?: boolean; reason?: string; error?: any }> {
  const establishmentId = String(input.establishmentId || '').trim();
  const sourceKey = buildSourceKey(input);
  if (!supabaseAdmin || !establishmentId || !sourceKey) {
    return { ok: false, skipped: true, reason: 'missing_required_fields' };
  }

  const grossAmountCents = Number(input.grossAmountCents);
  const row = {
    establishment_id: establishmentId,
    source_key: sourceKey,
    source_type: input.sourceType,
    source_id: String(input.sourceId || '').trim() || null,
    payment_id: String(input.paymentId || '').trim() || null,
    external_reference: String(input.externalReference || '').trim() || null,
    payment_method: normalizePaymentMethod(input.paymentMethod),
    gross_amount_cents: Number.isFinite(grossAmountCents) && grossAmountCents > 0 ? Math.round(grossAmountCents) : null,
    commission_cents: 100,
    status: 'paid',
    paid_at: String(input.paidAt || '').trim() || new Date().toISOString(),
    metadata: input.metadata || {},
  };

  const { error } = await supabaseAdmin
    .from('admin_mp_commissions')
    .upsert(row, { onConflict: 'source_key', ignoreDuplicates: true });

  if (error) {
    if (isMissingCommissionTableError(error)) {
      console.warn('Tabela admin_mp_commissions ainda não existe. Comissão MP não registrada.', error);
      return { ok: false, skipped: true, reason: 'missing_table', error };
    }
    console.error('Erro ao registrar comissão Mercado Pago do admin:', error);
    return { ok: false, error };
  }

  return { ok: true };
}
