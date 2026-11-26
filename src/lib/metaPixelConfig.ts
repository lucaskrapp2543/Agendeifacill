/**
 * Pixel do Meta (Facebook/Instagram) — dados usados tanto no navegador quanto no servidor.
 *
 * Nada aqui é segredo: o número do pixel aparece no código de qualquer site que usa pixel.
 * A chave que é segredo (META_CAPI_TOKEN) fica só no Netlify.
 */

/** "pixel agendei facil" da conta de anúncios "Conta Lucas Agendei 01". */
export const META_PIXEL_ID = '760382943505536';

/**
 * Valor de cada plano para o Meta saber quanto vale a venda.
 * Mesmos valores do PlanosCards / CadastroAg (precoDiamante = 67.9 / precoPrata = 37.9).
 */
export const META_VALOR_PLANO = { diamante: 67.9, prata: 37.9 } as const;

/**
 * Nome único de cada compra. O navegador e o servidor avisam a MESMA compra com o MESMO nome,
 * e o Meta junta os dois avisos em um só (não conta a venda em dobro).
 */
export const idCompraSite = (checkoutId: unknown): string => `compra-site-${String(checkoutId ?? '').trim()}`;
export const idCompraCakto = (orderId: unknown): string => `compra-cakto-${String(orderId ?? '').trim()}`;
