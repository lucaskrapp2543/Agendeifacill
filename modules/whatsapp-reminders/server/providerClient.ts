import { metaSendMessage, type MetaTemplatePayload } from './metaClient';
import { wasenderSendMessage } from './wasenderClient';
import { sendWhatsAppMessage } from '../../../server/services/whatsapp';

export type ProviderSendResult = {
  ok: boolean;
  status: number;
  data?: unknown;
  errorText?: string;
};

const normalizeProvider = (provider: string): string => {
  const value = String(provider || '').trim().toLowerCase();
  if (!value) return 'wasender';
  // Compat: qualquer alias de "Meta oficial (Cloud API)" deve cair no fluxo Meta.
  if (value.includes('meta')) return 'meta';
  if (value.includes('cloud_api') || value.includes('cloud api')) return 'meta';
  return value;
};

export async function sendWhatsappByProvider(params: {
  provider: string;
  to: string;
  text: string;
  encryptedApiKeyDecrypted: string;
  wasenderBaseUrl?: string;
  metaPhoneNumberId?: string;
  metaTemplate?: MetaTemplatePayload;
}): Promise<ProviderSendResult> {
  const provider = normalizeProvider(params.provider);

  if (provider === 'meta' || provider === 'meta_cloud' || provider === 'meta_cloud_api' || provider === 'cloud_api') {
    const metaResult = await metaSendMessage({
      accessToken: params.encryptedApiKeyDecrypted,
      phoneNumberId: String(params.metaPhoneNumberId || '').trim(),
      to: params.to,
      text: params.text,
      template: params.metaTemplate,
    });

    // Fallback opcional para Baileys quando a Meta falhar.
    // Mantém o fluxo atual intacto e só ativa se configurado por ambiente.
    const fallbackUserId = String(process.env.WHATSAPP_BAILEYS_FALLBACK_USER_ID || '').trim();
    if (!metaResult.ok && fallbackUserId) {
      const fallback = await sendWhatsAppMessage(fallbackUserId, params.to, params.text);
      if (fallback.ok) {
        return {
          ok: true,
          status: 200,
          data: {
            fallback_provider: 'baileys',
            fallback_user_id: fallbackUserId,
            fallback_message_id: fallback.messageId || null,
            meta_error: metaResult.errorText || null,
            meta_status: metaResult.status,
          },
        };
      }
    }

    return metaResult;
  }

  const baseUrl = String(params.wasenderBaseUrl || process.env.WASENDER_BASE_URL || '').trim();
  if (!baseUrl) {
    throw new Error('WASENDER_BASE_URL não configurado para provider wasender.');
  }

  return wasenderSendMessage({
    baseUrl,
    apiKey: params.encryptedApiKeyDecrypted,
    to: params.to,
    text: params.text,
  });
}

