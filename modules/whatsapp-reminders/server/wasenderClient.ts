export type WaSenderSendMessageRequest = {
  to: string; // Ex: 5511999999999 (somente dígitos)
  text: string;
};

export type WaSenderSendMessageResult = {
  ok: boolean;
  status: number;
  data?: unknown;
  errorText?: string;
};

function normalizePhoneToDigits(phone: string): string {
  return String(phone || '').replace(/\D/g, '');
}

export async function wasenderSendMessage(params: {
  baseUrl: string;
  apiKey: string;
  to: string;
  text: string;
  timeoutMs?: number;
}): Promise<WaSenderSendMessageResult> {
  const baseUrl = params.baseUrl.replace(/\/+$/, '');
  const to = normalizePhoneToDigits(params.to);
  const text = String(params.text || '');

  if (!to) throw new Error('Destino inválido (to) para envio de WhatsApp.');
  if (!text.trim()) throw new Error('Mensagem vazia (text) para envio de WhatsApp.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs ?? 15000);

  try {
    const res = await fetch(`${baseUrl}/api/send-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.apiKey}`,
      },
      body: JSON.stringify({ to, text } satisfies WaSenderSendMessageRequest),
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


