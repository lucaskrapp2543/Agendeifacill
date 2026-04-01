import { metaSendMessage, type MetaTemplatePayload } from './metaClient';
import { wasenderSendMessage } from './wasenderClient';

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
    return metaSendMessage({
      accessToken: params.encryptedApiKeyDecrypted,
      phoneNumberId: String(params.metaPhoneNumberId || '').trim(),
      to: params.to,
      text: params.text,
      template: params.metaTemplate,
    });
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

