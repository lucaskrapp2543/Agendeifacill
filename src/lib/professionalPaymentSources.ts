/**
 * Origem dos registros em `professional_payments`.
 *
 * A tabela guarda TRÊS tipos de acerto com o profissional, todos no mesmo lugar:
 *   - serviço  → payment_source 'normal' (ou NULL, em registros antigos)
 *   - assinatura → 'subscription' / 'assinatura'
 *   - produto  → 'product'
 *
 * Cada tela soma apenas a sua fatia. Se um pagamento de produto for contado como
 * pagamento de serviço, o "falta pagar" dos serviços cai sozinho e o profissional
 * recebe a menos — por isso a regra fica AQUI, num só lugar, e não repetida em
 * cada arquivo (era assim antes e é como as regras divergem).
 */

/** Vendas de produto anteriores a esta data NÃO entram no acerto do sistema. */
export const PRODUCT_PAYOUT_START_DATE = '2026-08-27';

const norm = (src: unknown): string => String(src ?? '').trim().toLowerCase();

export const isSubscriptionPaymentSource = (src: unknown): boolean => {
  const s = norm(src);
  return s === 'subscription' || s === 'assinatura';
};

export const isProductPaymentSource = (src: unknown): boolean => {
  const s = norm(src);
  return s === 'product' || s === 'produto';
};

/**
 * Pagamento de SERVIÇO — o "normal" do financeiro.
 * Inclui registros antigos com payment_source vazio/NULL (compatibilidade).
 */
export const isServicePaymentSource = (src: unknown): boolean =>
  !isSubscriptionPaymentSource(src) && !isProductPaymentSource(src);
