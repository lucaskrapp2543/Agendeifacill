import { PARTNER_REFERRAL_DIAMANTE_DISCOUNT_PERCENT } from './partnerReferralCode';

/**
 * Cupom interno de QA — remover este arquivo/regra quando não precisar mais testar checkout barato.
 *
 * Somente igualdade exata após normalização (A-Z, 0-9, maiúsculas, sem espaços).
 * Ex.: BITELO10 ✅ | BITELO11 ❌ | BITELO ❌ | TESTE10 ❌
 */
export const PARTNER_REFERRAL_INTERNAL_TEST_COUPON_CODE = 'BITELO10' as const;

/** 90% OFF no 1º pagamento Diamante — ex.: R$67,90 → R$6,79 */
export const PARTNER_REFERRAL_INTERNAL_TEST_DIAMANTE_DISCOUNT_PERCENT = 90;

export function isPartnerReferralInternalTestCoupon(normalizedCode: string): boolean {
  return normalizedCode === PARTNER_REFERRAL_INTERNAL_TEST_COUPON_CODE;
}

export function resolvePartnerReferralDiamanteDiscountPercent(normalizedCode: string): number {
  if (isPartnerReferralInternalTestCoupon(normalizedCode)) {
    return PARTNER_REFERRAL_INTERNAL_TEST_DIAMANTE_DISCOUNT_PERCENT;
  }
  return PARTNER_REFERRAL_DIAMANTE_DISCOUNT_PERCENT;
}
