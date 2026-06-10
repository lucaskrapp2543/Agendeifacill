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
