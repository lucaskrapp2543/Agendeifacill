/** Link público para o cliente (sempre produção — localhost não abre no celular do cliente). */
export const buildReviewBookingDeepLink = (establishmentCode: string): string => {
  const code = String(establishmentCode || '').trim();
  return `https://agendeifacil.com/booking/${code}?avaliar=1`;
};

export const buildThankYouWhatsAppMessage = (params: {
  clientName: string;
  establishmentName: string;
  bookingLink: string;
}): string => {
  const clientName = String(params.clientName || '').trim() || 'cliente';
  const establishmentName = String(params.establishmentName || '').trim() || 'nossa barbearia';
  const bookingLink = String(params.bookingLink || '').trim();

  return `Oi, ${clientName}! 💈✨

Passando aqui pra agradecer sua visita na ${establishmentName} hoje! Foi um prazer te receber 🙌

Queria pedir uma ajudinha sua... Consegue entrar nesse link e avaliar nosso estabelecimento? Isso ajuda MUITO no nosso crescimento 📈💪

Acesse aqui:
${bookingLink}

Nós da ${establishmentName} nos importamos muito com a sua opinião! 😊🙏

Valeu demais! 🤝`;
};

export const formatClientWhatsappForMessage = (clientWhatsapp: string): string | null => {
  let phoneNumber = String(clientWhatsapp || '').replace(/\D/g, '');
  if (!phoneNumber) return null;

  const countryCodes = [
    { code: '351', minLength: 12 },
    { code: '244', minLength: 12 },
    { code: '54', minLength: 12 },
    { code: '56', minLength: 11 },
    { code: '55', minLength: 12 },
    { code: '34', minLength: 11 },
    { code: '1', minLength: 11 },
  ];
  const hasCountryCode = countryCodes.some(
    ({ code, minLength }) => phoneNumber.startsWith(code) && phoneNumber.length >= minLength
  );
  if (!hasCountryCode && phoneNumber.length >= 10 && phoneNumber.length <= 11) {
    phoneNumber = `55${phoneNumber}`;
  }

  return phoneNumber;
};

/** Apenas dígitos — base para comparar telefones de agendamento vs avaliação. */
export function normalizeReviewPhoneDigits(raw: string): string {
  return String(raw || '').replace(/\D/g, '');
}

/** Variantes com/sem DDI e 9º dígito (BR) para bater telefones equivalentes. */
export function buildReviewPhoneVariants(raw: string): string[] {
  const digits = normalizeReviewPhoneDigits(raw);
  if (!digits) return [];

  const variants = new Set<string>([digits]);

  if (digits.startsWith('55') && digits.length >= 12) {
    variants.add(digits.slice(2));
  }
  if (!digits.startsWith('55') && digits.length >= 10 && digits.length <= 11) {
    variants.add(`55${digits}`);
  }
  if (digits.length === 10) {
    variants.add(`${digits.slice(0, 2)}9${digits.slice(2)}`);
  }
  if (digits.length === 11 && digits.charAt(2) === '9') {
    variants.add(`${digits.slice(0, 2)}${digits.slice(3)}`);
  }
  const withoutCountry = digits.startsWith('55') && digits.length > 2 ? digits.slice(2) : digits;
  if (withoutCountry.length === 10) {
    variants.add(`55${withoutCountry.slice(0, 2)}9${withoutCountry.slice(2)}`);
    variants.add(`${withoutCountry.slice(0, 2)}9${withoutCountry.slice(2)}`);
  }
  if (withoutCountry.length === 11 && withoutCountry.charAt(2) === '9') {
    variants.add(`55${withoutCountry}`);
    variants.add(`${withoutCountry.slice(0, 2)}${withoutCountry.slice(3)}`);
    variants.add(`55${withoutCountry.slice(0, 2)}${withoutCountry.slice(3)}`);
  }

  return Array.from(variants).filter(Boolean);
}

export function reviewPhonesMatch(phoneA: string, phoneB: string): boolean {
  const variantsA = buildReviewPhoneVariants(phoneA);
  const variantsB = new Set(buildReviewPhoneVariants(phoneB));
  if (variantsA.length === 0 || variantsB.size === 0) return false;
  return variantsA.some((variant) => variantsB.has(variant));
}

/** Verifica se o cliente já enviou alguma avaliação para o estabelecimento (qualquer status). */
export async function clientHasReviewForEstablishment(params: {
  supabase: { from: (table: string) => any };
  establishmentId: string;
  clientPhone: string;
}): Promise<boolean> {
  const establishmentId = String(params.establishmentId || '').trim();
  const clientPhone = String(params.clientPhone || '').trim();
  if (!establishmentId || !clientPhone) return false;

  const clientVariants = new Set(buildReviewPhoneVariants(clientPhone));
  if (clientVariants.size === 0) return false;

  try {
    const { data, error } = await params.supabase
      .from('establishment_reviews')
      .select('client_phone')
      .eq('establishment_id', establishmentId);

    if (error) {
      const msg = String(error.message || '').toLowerCase();
      const missingTable =
        msg.includes('establishment_reviews') &&
        (msg.includes('does not exist') || msg.includes('relation') || msg.includes('schema cache'));
      if (!missingTable) {
        console.warn('Avaliações: falha ao verificar telefone do cliente:', error.message, error.details);
      }
      return false;
    }

    return (data || []).some((row: { client_phone?: string | null }) =>
      reviewPhonesMatch(clientPhone, String(row?.client_phone || ''))
    );
  } catch (error) {
    console.warn('Avaliações: erro inesperado ao verificar telefone do cliente:', error);
    return false;
  }
}
