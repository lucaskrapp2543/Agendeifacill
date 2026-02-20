import { metaSendMessage } from './metaClient';
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
  return value;
};

export async function sendWhatsappByProvider(params: {
  provider: string;
  to: string;
  text: string;
  encryptedApiKeyDecrypted: string;
  wasenderBaseUrl?: string;
  metaPhoneNumberId?: string;
}): Promise<ProviderSendResult> {
  const provider = normalizeProvider(params.provider);

  if (provider === 'meta' || provider === 'meta_cloud' || provider === 'meta_cloud_api' || provider === 'cloud_api') {
    return metaSendMessage({
      accessToken: params.encryptedApiKeyDecrypted,
      phoneNumberId: String(params.metaPhoneNumberId || '').trim(),
      to: params.to,
      text: params.text,
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

