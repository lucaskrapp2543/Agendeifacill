export const EXCLUSIVE_PROFESSIONAL_URL_PARAM = 'pro';

export const buildExclusiveProfessionalBookingLink = (
  establishmentCode: string,
  professionalId: string
): string => {
  const code = String(establishmentCode || '').trim();
  const proId = String(professionalId || '').trim();
  return `https://agendeifacil.com/booking/${code}?${EXCLUSIVE_PROFESSIONAL_URL_PARAM}=${encodeURIComponent(proId)}`;
};

export const parseExclusiveProfessionalIdFromSearch = (search: string): string | null => {
  const params = new URLSearchParams(String(search || ''));
  const raw =
    params.get(EXCLUSIVE_PROFESSIONAL_URL_PARAM) ||
    params.get('profissional') ||
    params.get('professional');
  const id = String(raw || '').trim();
  return id || null;
};

/** Padrão: ativo. Só some se o profissional tiver desativado explicitamente. */
export const isExclusiveBookingLinkEnabledForProfessional = (professional: unknown): boolean => {
  return !Boolean((professional as any)?.exclusive_booking_link_disabled);
};
