/**
 * Venda do Plano Diamante pela Cakto (novos clientes) — 25/11/2026.
 *
 * Fluxo: página inicial → pagamento na Cakto → a Cakto avisa o sistema (função
 * `cakto-webhook`) → o cliente cria a conta em `/cadastrar` com o e-mail da compra.
 *
 * Nada aqui é segredo. A chave do aviso (CAKTO_WEBHOOK_SECRET) fica só no Netlify.
 */

/**
 * CHAVE GERAL. Enquanto estiver `false`, a página inicial continua mandando para o
 * cadastro antigo (/cadastroag, Mercado Pago). Só virar para `true` DEPOIS de testar
 * uma compra de verdade: se os botões apontarem para a Cakto sem o aviso configurado,
 * o cliente paga e não consegue criar a conta.
 *
 * LIGADA em 26/11/2026 por decisão do Lucas, para os anúncios novos já venderem pela Cakto.
 * O aviso da Cakto, a chave e a página /cadastrar estavam no ar e conferidos; a primeira compra
 * de verdade ainda não tinha sido feita. Para voltar ao cadastro antigo, é só pôr false aqui.
 */
export const CAKTO_CHECKOUT_ATIVO: boolean = true;

/** Link de pagamento da oferta "Agendei Fácil" (R$ 67,90/mês, Pix automático ou cartão). */
export const CAKTO_CHECKOUT_URL = 'https://pay.cakto.com.br/mk63zjt_645031';

/** ID do produto "Agendei Fácil" na Cakto. Aviso de qualquer outro produto é ignorado. */
export const CAKTO_PRODUCT_ID = 'd6f5a722-958d-431c-8a89-c4ddc2f609ef';

/** Plano que a compra libera. */
export const CAKTO_PLANO = {
  key: 'diamante',
  label: 'DIAMANTE',
  /** Usado só se o aviso vier sem valor. O normal é gravar o valor que a Cakto informou. */
  amountCents: 6790,
  /** Diamante = plano completo (plan_prata_active desligado). */
  planPrataActive: false,
} as const;

/** Onde o cliente cria a conta depois de pagar (é a "página de obrigado" do produto na Cakto). */
export const CAKTO_CADASTRO_PATH = '/cadastrar';

/** Nome do provedor nos registros de pagamento (establishment_billing_payments.payment_provider). */
export const CAKTO_PAYMENT_PROVIDER = 'cakto';

/** payment_id usado no histórico de pagamentos: um por pedido da Cakto. */
export const caktoPaymentId = (orderId: string) => `cakto-${String(orderId || '').trim()}`;
