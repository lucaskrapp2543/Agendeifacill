type CardTokenInput = {
  number: string;
  holder_name: string;
  exp_month: string;
  exp_year: string;
  cvv: string;
  holder_document?: string;
  brand?: string;
  label?: string;
};

const onlyDigits = (v: string) => String(v || '').replace(/\D/g, '');

/**
 * Tokeniza cartão diretamente na Pagar.me (Core v5) usando a chave pública (pk_) via query param appId.
 *
 * ⚠️ Esta função roda no FRONTEND. Ela NÃO usa secret key e NÃO envia Authorization, conforme a doc:
 * - "Não utilize a secret_key"
 * - use appId (public key) em query string
 *
 * Doc: https://docs.pagar.me/reference/criar-token-cart%C3%A3o-1
 */
export async function criarTokenCartaoPagarme(input: CardTokenInput): Promise<string> {
  const appId = String(import.meta.env.VITE_PAGARME_PUBLIC_KEY || '').trim();
  if (!appId) {
    throw new Error(
      'Cartão indisponível: configure a variável VITE_PAGARME_PUBLIC_KEY (pk_...) no Netlify e no .env do localhost.'
    );
  }
  if (!appId.startsWith('pk_')) {
    throw new Error('Cartão indisponível: VITE_PAGARME_PUBLIC_KEY deve começar com pk_.');
  }

  const url = `https://api.pagar.me/core/v5/tokens?appId=${encodeURIComponent(appId)}`;

  const body: any = {
    type: 'card',
    card: {
      number: onlyDigits(input.number),
      holder_name: String(input.holder_name || '').trim(),
      exp_month: String(input.exp_month || '').replace(/\D/g, ''),
      exp_year: String(input.exp_year || '').replace(/\D/g, ''),
      cvv: onlyDigits(input.cvv),
    },
  };

  const holderDocument = onlyDigits(String(input.holder_document || ''));
  if (holderDocument) body.card.holder_document = holderDocument;
  if (input.brand) body.card.brand = String(input.brand).trim();
  if (input.label) body.card.label = String(input.label).trim();

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    // A API costuma devolver "message" + erros em "errors"
    const msg =
      data?.message ||
      data?.error ||
      (typeof data?.errors?.request?.card?.[0] === 'string' ? data.errors.request.card[0] : null) ||
      `Erro ${response.status} ao tokenizar cartão`;
    throw new Error(String(msg));
  }

  const tokenId = data?.id || data?.token || data?.card_token;
  if (!tokenId) {
    throw new Error('Token do cartão não retornado pela Pagar.me.');
  }

  return String(tokenId);
}


