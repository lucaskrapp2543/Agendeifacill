export type MetaSendMessageResult = {
  ok: boolean;
  status: number;
  data?: unknown;
  errorText?: string;
};

function normalizePhoneToDigits(phone: string): string {
  return String(phone || '').replace(/\D/g, '');
}

export async function metaSendMessage(params: {
  accessToken: string;
  phoneNumberId: string;
  to: string;
  text: string;
  apiVersion?: string;
  timeoutMs?: number;
}): Promise<MetaSendMessageResult> {
  const token = String(params.accessToken || '').trim();
  const phoneNumberId = String(params.phoneNumberId || '').trim();
  const to = normalizePhoneToDigits(params.to);
  const text = String(params.text || '');
  const apiVersion = String(params.apiVersion || process.env.META_WHATSAPP_API_VERSION || 'v22.0').trim();

  if (!token) throw new Error('Token da Meta vazio para envio de WhatsApp.');
  if (!phoneNumberId) throw new Error('phone_number_id da Meta vazio para envio de WhatsApp.');
  if (!to) throw new Error('Destino inválido (to) para envio de WhatsApp.');
  if (!text.trim()) throw new Error('Mensagem vazia (text) para envio de WhatsApp.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs ?? 15000);

  try {
    const res = await fetch(`https://graph.facebook.com/${apiVersion}/${encodeURIComponent(phoneNumberId)}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      }),
      signal: controller.signal,
    });

    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const data = isJson ? await res.json().catch(() => undefined) : await res.text().catch(() => undefined);

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        data,
        errorText: typeof data === 'string' ? data : undefined,
      };
    }

    return { ok: true, status: res.status, data };
  } finally {
    clearTimeout(timeout);
  }
}

