export const PARTNER_REFERRAL_DIAMANTE_DISCOUNT_PERCENT = 5;
export const SITE_REGISTRATION_DIAMANTE_AMOUNT_CENTS = 6790;

/** Normaliza cupom: maiúsculas, sem espaços, só A-Z e 0-9. */
export function normalizePartnerReferralCodeInput(raw: string): string {
  return String(raw || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 20);
}

export function computePartnerReferralFirstPaymentAmount(originalAmountCents: number, discountPercent: number) {
  const discountCents = Math.round((originalAmountCents * discountPercent) / 100);
  const finalAmountCents = Math.max(0, originalAmountCents - discountCents);
  return {
    originalAmountCents,
    discountPercent,
    discountCents,
    finalAmountCents,
  };
}

export function readPartnerReferralCupomFromSearch(search: string): string {
  const raw = new URLSearchParams(search).get('cupom') || '';
  return normalizePartnerReferralCodeInput(raw);
}

export function buildCadastroAgLink(input: { plan: 'prata' | 'diamante'; cupom?: string | null }): string {
  const plan = input.plan === 'prata' ? 'prata' : 'diamante';
  const cupom = normalizePartnerReferralCodeInput(String(input.cupom || ''));
  const params = new URLSearchParams({ plan });
  if (cupom) params.set('cupom', cupom);
  return `/cadastroag?${params.toString()}`;
}

export function appendPartnerReferralCupomToUrl(url: string, cupom?: string | null): string {
  const normalized = normalizePartnerReferralCodeInput(String(cupom || ''));
  if (!normalized) return url;
  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'https://agendeifacil.com');
    parsed.searchParams.set('cupom', normalized);
    return parsed.pathname + parsed.search;
  } catch {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}cupom=${encodeURIComponent(normalized)}`;
  }
}
