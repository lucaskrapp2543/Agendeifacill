import { PARTNER_REFERRAL_DIAMANTE_DISCOUNT_PERCENT } from './partnerReferralCode';

/** Desconto no 1º pagamento Diamante para qualquer cupom de parceiro válido (incl. BITELO10). */
export function resolvePartnerReferralDiamanteDiscountPercent(_normalizedCode: string): number {
  return PARTNER_REFERRAL_DIAMANTE_DISCOUNT_PERCENT;
}
