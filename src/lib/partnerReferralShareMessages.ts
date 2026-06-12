import { buildPartnerReferralPlansLink, normalizePartnerReferralCodeInput } from './partnerReferral';

export type PartnerReferralShareTemplateId = 'friendly' | 'professional' | 'story';

export type PartnerReferralShareTemplate = {
  id: PartnerReferralShareTemplateId;
  emoji: string;
  title: string;
  subtitle: string;
  message: string;
  showWhatsApp: boolean;
  showShare: boolean;
};

export function formatPartnerReferralShareLink(code: string): string {
  const normalized = normalizePartnerReferralCodeInput(code);
  if (!normalized) return 'agendeifacil.com/planos';
  return `agendeifacil.com/planos?cupom=${encodeURIComponent(normalized)}`;
}

export function buildPartnerReferralShareTemplates(code: string): PartnerReferralShareTemplate[] {
  const cupom = normalizePartnerReferralCodeInput(code);
  const link = formatPartnerReferralShareLink(cupom);
  const fullLink = buildPartnerReferralPlansLink(cupom);

  return [
    {
      id: 'friendly',
      emoji: '1️⃣',
      title: 'Mensagem amigável',
      subtitle: 'Para mandar para barbeiro conhecido',
      showWhatsApp: true,
      showShare: false,
      message:
        `💈 Fala irmão! Preciso te mostrar esse sistema que comecei usar.\n\n` +
        `Sinceramente um dos mais completos que achei para barbearia.\n\n` +
        `Tem agendamento online, cobrança recorrente, cliente mensalista, WhatsApp automático, sistema de assinatura, AFCoins, pagamento adiantado, página exclusiva da barbearia e várias funções top.\n\n` +
        `Se quiser testar usa meu cupom:\n\n` +
        `${cupom}\n\n` +
        `Você ainda ganha desconto no plano 👊\n\n` +
        `Link:\n${link}`,
    },
    {
      id: 'professional',
      emoji: '2️⃣',
      title: 'Mensagem profissional',
      subtitle: 'Tom mais sério e direto',
      showWhatsApp: true,
      showShare: false,
      message:
        `💈 Indicação profissional\n\n` +
        `Se você procura um sistema moderno para sua barbearia, recomendo conhecer o Agendei Fácil.\n\n` +
        `Sistema completo com:\n\n` +
        `✅ Agendamento online\n` +
        `✅ Cliente mensalista\n` +
        `✅ Cobrança recorrente\n` +
        `✅ Pagamento adiantado\n` +
        `✅ WhatsApp automático\n` +
        `✅ Página exclusiva da sua barbearia\n` +
        `✅ AFCoins para fidelização\n\n` +
        `Use meu cupom:\n\n` +
        `${cupom}\n\n` +
        `Link:\n${link}`,
    },
    {
      id: 'story',
      emoji: '3️⃣',
      title: 'Texto para Story / Bio',
      subtitle: 'Curto para Instagram e redes',
      showWhatsApp: false,
      showShare: true,
      message:
        `💈 Quer um sistema top pra sua barbearia?\n\n` +
        `Uso e recomendo:\n\n` +
        `Agendei Fácil 👊\n\n` +
        `Use meu cupom:\n\n` +
        `${cupom}\n\n` +
        `Link na bio 🔥\n${fullLink}`,
    },
  ];
}

export function openPartnerReferralWhatsAppShare(message: string): void {
  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
}

export async function sharePartnerReferralText(message: string): Promise<'shared' | 'copied' | 'failed'> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ text: message });
      return 'shared';
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') return 'shared';
    }
  }

  try {
    await navigator.clipboard.writeText(message);
    return 'copied';
  } catch {
    return 'failed';
  }
}
