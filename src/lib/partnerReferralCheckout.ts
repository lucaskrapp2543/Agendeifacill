import {
  computePartnerReferralFirstPaymentAmount,
  normalizePartnerReferralCodeInput,
  PARTNER_REFERRAL_DIAMANTE_DISCOUNT_PERCENT,
  SITE_REGISTRATION_DIAMANTE_AMOUNT_CENTS,
} from './partnerReferralCode';
import { resolvePartnerReferralDiamanteDiscountPercent } from './partnerReferralTestCoupon';

export {
  PARTNER_REFERRAL_DIAMANTE_DISCOUNT_PERCENT,
  SITE_REGISTRATION_DIAMANTE_AMOUNT_CENTS,
  computePartnerReferralFirstPaymentAmount,
} from './partnerReferralCode';

export type PartnerReferralCheckoutPricing = {
  originalAmountCents: number;
  finalAmountCents: number;
  chargeAmountCents: number;
  recurringAmountCents: number;
  discountPercent: number | null;
  partnerReferralCode: string | null;
  partnerEstablishmentId: string | null;
  partnerEstablishmentName: string | null;
};

export type PartnerReferralValidationResult =
  | {
      ok: true;
      code: string;
      partnerEstablishmentId: string;
      partnerEstablishmentName: string;
      pricing: PartnerReferralCheckoutPricing;
    }
  | {
      ok: false;
      reason: 'invalid_plan' | 'invalid_code' | 'inactive' | 'self_referral' | 'missing_table' | 'unknown';
      message: string;
    };

export function buildPartnerReferralCheckoutPricing(input: {
  planKey: string;
  baseAmountCents: number;
  partnerReferralCode?: string | null;
  partnerEstablishmentId?: string | null;
  partnerEstablishmentName?: string | null;
  discountPercent?: number | null;
}): PartnerReferralCheckoutPricing {
  const originalAmountCents = input.baseAmountCents;
  const hasPartnerDiscount =
    input.planKey === 'diamante' &&
    Boolean(input.partnerReferralCode) &&
    Boolean(input.partnerEstablishmentId) &&
    Number(input.discountPercent || 0) > 0;

  if (!hasPartnerDiscount) {
    return {
      originalAmountCents,
      finalAmountCents: originalAmountCents,
      chargeAmountCents: originalAmountCents,
      recurringAmountCents: originalAmountCents,
      discountPercent: null,
      partnerReferralCode: null,
      partnerEstablishmentId: null,
      partnerEstablishmentName: null,
    };
  }

  const { finalAmountCents, discountPercent } = computePartnerReferralFirstPaymentAmount(
    originalAmountCents,
    Number(input.discountPercent)
  );

  return {
    originalAmountCents,
    finalAmountCents,
    chargeAmountCents: finalAmountCents,
    recurringAmountCents: originalAmountCents,
    discountPercent,
    partnerReferralCode: input.partnerReferralCode || null,
    partnerEstablishmentId: input.partnerEstablishmentId || null,
    partnerEstablishmentName: input.partnerEstablishmentName || null,
  };
}

function isMissingPartnerReferralTableError(error: unknown): boolean {
  const msg = String((error as any)?.message || '').toLowerCase();
  const code = String((error as any)?.code || '');
  return (
    code === '42P01' ||
    (msg.includes('partner_referral') &&
      (msg.includes('does not exist') || msg.includes('relation') || msg.includes('schema cache')))
  );
}

export async function validatePartnerReferralForSiteRegistration(
  supabaseAdmin: any,
  input: {
    planKey: string;
    rawCode?: string | null;
    registrationEmail?: string | null;
    baseAmountCents: number;
    requireCodeWhenProvided?: boolean;
  }
): Promise<PartnerReferralValidationResult> {
  const planKey = String(input.planKey || '').toLowerCase().trim();
  const normalizedCode = normalizePartnerReferralCodeInput(String(input.rawCode || ''));

  if (planKey !== 'diamante') {
    if (normalizedCode) {
      return {
        ok: false,
        reason: 'invalid_plan',
        message: 'Cupom de indicação disponível apenas no plano Diamante.',
      };
    }
    return {
      ok: false,
      reason: 'invalid_plan',
      message: 'Cupom disponível apenas no plano Diamante.',
    };
  }

  if (!normalizedCode) {
    return {
      ok: false,
      reason: 'invalid_code',
      message: 'Cupom inválido ou não encontrado.',
    };
  }

  try {
    const { data: codeRow, error: codeError } = await supabaseAdmin
      .from('partner_referral_codes')
      .select('id, establishment_id, code, is_active')
      .eq('code', normalizedCode)
      .maybeSingle();

    if (codeError) {
      if (isMissingPartnerReferralTableError(codeError)) {
        return {
          ok: false,
          reason: 'missing_table',
          message: 'Programa de indicação ainda não está disponível. Tente novamente em instantes.',
        };
      }
      return {
        ok: false,
        reason: 'unknown',
        message: codeError.message || 'Erro ao validar cupom.',
      };
    }

    if (!codeRow?.establishment_id || !codeRow?.code) {
      return {
        ok: false,
        reason: 'invalid_code',
        message: 'Cupom inválido ou não encontrado.',
      };
    }

    if (!codeRow.is_active) {
      return {
        ok: false,
        reason: 'inactive',
        message: 'Cupom inválido ou não encontrado.',
      };
    }

    const partnerEstablishmentId = String(codeRow.establishment_id);
    const { data: partnerEstablishment, error: partnerError } = await supabaseAdmin
      .from('establishments')
      .select('id, name, owner_id')
      .eq('id', partnerEstablishmentId)
      .maybeSingle();

    if (partnerError || !partnerEstablishment?.id) {
      return {
        ok: false,
        reason: 'invalid_code',
        message: 'Cupom inválido ou não encontrado.',
      };
    }

    const registrationEmail = String(input.registrationEmail || '')
      .trim()
      .toLowerCase();
    if (registrationEmail && partnerEstablishment.owner_id) {
      const { data: ownerData, error: ownerError } = await supabaseAdmin.auth.admin.getUserById(
        String(partnerEstablishment.owner_id)
      );
      const ownerEmail = String(ownerData?.user?.email || '').trim().toLowerCase();
      if (!ownerError && ownerEmail && ownerEmail === registrationEmail) {
        return {
          ok: false,
          reason: 'self_referral',
          message: 'Você não pode usar o seu próprio cupom de indicação.',
        };
      }
    }

    const pricing = buildPartnerReferralCheckoutPricing({
      planKey,
      baseAmountCents: input.baseAmountCents,
      partnerReferralCode: String(codeRow.code),
      partnerEstablishmentId,
      partnerEstablishmentName: String(partnerEstablishment.name || 'barbearia parceira'),
      discountPercent: resolvePartnerReferralDiamanteDiscountPercent(normalizedCode),
    });

    return {
      ok: true,
      code: String(codeRow.code),
      partnerEstablishmentId,
      partnerEstablishmentName: String(partnerEstablishment.name || 'barbearia parceira'),
      pricing,
    };
  } catch (error: any) {
    if (isMissingPartnerReferralTableError(error)) {
      return {
        ok: false,
        reason: 'missing_table',
        message: 'Programa de indicação ainda não está disponível. Tente novamente em instantes.',
      };
    }
    return {
      ok: false,
      reason: 'unknown',
      message: error?.message || 'Erro ao validar cupom.',
    };
  }
}

export async function resolvePartnerReferralForSiteRegistrationCheckout(
  supabaseAdmin: any,
  input: {
    planKey: string;
    rawCode?: string | null;
    registrationEmail?: string | null;
    baseAmountCents: number;
  }
): Promise<
  | { ok: true; pricing: PartnerReferralCheckoutPricing; validation?: PartnerReferralValidationResult }
  | { ok: false; message: string; reason?: string }
> {
  const planKey = String(input.planKey || '').toLowerCase().trim();
  const normalizedCode = normalizePartnerReferralCodeInput(String(input.rawCode || ''));

  const basePricing = buildPartnerReferralCheckoutPricing({
    planKey,
    baseAmountCents: input.baseAmountCents,
  });

  if (planKey !== 'diamante' || !normalizedCode) {
    if (planKey !== 'diamante' && normalizedCode) {
      return { ok: false, message: 'Cupom de indicação disponível apenas no plano Diamante.', reason: 'invalid_plan' };
    }
    return { ok: true, pricing: basePricing };
  }

  const validation = await validatePartnerReferralForSiteRegistration(supabaseAdmin, {
    planKey,
    rawCode: normalizedCode,
    registrationEmail: input.registrationEmail,
    baseAmountCents: input.baseAmountCents,
  });

  if (!validation.ok) {
    return { ok: false, message: validation.message, reason: validation.reason };
  }

  return { ok: true, pricing: validation.pricing, validation };
}

export function getPartnerReferralRecurringStartDateIso(monthsFromNow = 1): string {
  const date = new Date();
  const day = date.getDate();
  date.setMonth(date.getMonth() + monthsFromNow);
  if (date.getDate() < day) date.setDate(0);
  return date.toISOString();
}

export function buildSiteRegistrationCheckoutPartnerColumns(pricing: PartnerReferralCheckoutPricing) {
  if (!pricing.partnerReferralCode) {
    return {
      partner_referral_code: null,
      partner_establishment_id: null,
      original_amount_cents: null,
      discount_percent: null,
      final_amount_cents: null,
    };
  }

  return {
    partner_referral_code: pricing.partnerReferralCode,
    partner_establishment_id: pricing.partnerEstablishmentId,
    original_amount_cents: pricing.originalAmountCents,
    discount_percent: pricing.discountPercent,
    final_amount_cents: pricing.finalAmountCents,
  };
}

export async function createPartnerReferralAfterConversion(
  supabaseAdmin: any,
  input: {
    checkout: Record<string, unknown>;
    referredEstablishmentId: string;
    referredOwnerId: string;
    paymentId?: string | null;
  }
): Promise<{ created: boolean; reason?: string; error?: string }> {
  const checkout = input.checkout || {};
  const planKey = String(checkout.selected_plan || '').toLowerCase().trim();
  const partnerEstablishmentId = String(checkout.partner_establishment_id || '').trim();
  const partnerReferralCode = String(checkout.partner_referral_code || '').trim();
  const checkoutId = String(checkout.id || '').trim();

  if (planKey !== 'diamante' || !partnerEstablishmentId || !partnerReferralCode) {
    return { created: false, reason: 'no_partner_checkout' };
  }

  if (partnerEstablishmentId === input.referredEstablishmentId) {
    return { created: false, reason: 'self_referral' };
  }

  try {
    const { data: partnerEstablishment, error: partnerError } = await supabaseAdmin
      .from('establishments')
      .select('id, owner_id')
      .eq('id', partnerEstablishmentId)
      .maybeSingle();

    if (partnerError || !partnerEstablishment?.id) {
      return { created: false, reason: 'partner_not_found', error: partnerError?.message };
    }

    if (String(partnerEstablishment.owner_id || '') === String(input.referredOwnerId || '')) {
      return { created: false, reason: 'self_referral' };
    }

    const nowIso = new Date().toISOString();
    const { error: insertError } = await supabaseAdmin.from('partner_referrals').insert({
      partner_establishment_id: partnerEstablishmentId,
      referred_establishment_id: input.referredEstablishmentId,
      referral_code: partnerReferralCode,
      selected_plan: 'diamante',
      status: 'active',
      linked_at: nowIso,
      first_payment_id: input.paymentId ? String(input.paymentId) : null,
      site_registration_checkout_id: checkoutId || null,
      updated_at: nowIso,
    } as any);

    if (insertError) {
      if (insertError.code === '23505') {
        return { created: false, reason: 'already_linked' };
      }
      if (isMissingPartnerReferralTableError(insertError)) {
        return { created: false, reason: 'missing_table', error: insertError.message };
      }
      return { created: false, reason: 'insert_failed', error: insertError.message };
    }

    return { created: true };
  } catch (error: any) {
    if (isMissingPartnerReferralTableError(error)) {
      return { created: false, reason: 'missing_table', error: error?.message };
    }
    return { created: false, reason: 'insert_failed', error: error?.message };
  }
}

export async function ensurePartnerReferralLinkForConvertedCheckout(
  supabaseAdmin: any,
  input: {
    checkout: Record<string, unknown>;
    checkoutId: string;
    referredEstablishmentId: string;
    referredOwnerId?: string | null;
    paymentId?: string | null;
  }
): Promise<{ created: boolean; reason?: string; error?: string; skipped?: boolean }> {
  const referredEstablishmentId = String(input.referredEstablishmentId || '').trim();
  const checkoutId = String(input.checkoutId || '').trim();
  if (!referredEstablishmentId || !checkoutId) {
    return { created: false, reason: 'missing_referred_establishment' };
  }

  const { data: existingReferral, error: existingError } = await supabaseAdmin
    .from('partner_referrals')
    .select('id')
    .eq('referred_establishment_id', referredEstablishmentId)
    .maybeSingle();

  if (existingError && !isMissingPartnerReferralTableError(existingError)) {
    return { created: false, reason: 'lookup_failed', error: existingError.message };
  }

  if (existingReferral?.id) {
    return { created: false, reason: 'already_linked', skipped: true };
  }

  let referredOwnerId = String(input.referredOwnerId || '').trim();
  if (!referredOwnerId) {
    const { data: referredEstablishment, error: referredError } = await supabaseAdmin
      .from('establishments')
      .select('owner_id')
      .eq('id', referredEstablishmentId)
      .maybeSingle();
    if (referredError) {
      return { created: false, reason: 'referred_not_found', error: referredError.message };
    }
    referredOwnerId = String(referredEstablishment?.owner_id || '').trim();
  }

  const partnerReferralResult = await createPartnerReferralAfterConversion(supabaseAdmin, {
    checkout: { ...input.checkout, id: checkoutId },
    referredEstablishmentId,
    referredOwnerId,
    paymentId: input.paymentId,
  });

  const checkoutAny = input.checkout as any;
  await supabaseAdmin
    .from('site_registration_checkouts')
    .update({
      metadata: {
        ...(checkoutAny.metadata || {}),
        partner_referral_linked: partnerReferralResult.created,
        partner_referral_reason: partnerReferralResult.reason || null,
        partner_referral_error: partnerReferralResult.error || null,
        partner_referral_retry_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', checkoutId);

  return partnerReferralResult;
}
