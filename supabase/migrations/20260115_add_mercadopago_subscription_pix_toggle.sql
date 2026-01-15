-- Adiciona toggle para usar PIX do Mercado Pago no fluxo de assinaturas (sem cobrança automática)
-- Quando true, no Booking o botão "Assinar" abre um modal que gera PIX via Mercado Pago.
-- Exclusão mútua: se Mercado Pago estiver ativo, Pagar.me deve estar desativado e vice-versa.

ALTER TABLE establishments
ADD COLUMN IF NOT EXISTS use_mercadopago_subscription_pix BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN establishments.use_mercadopago_subscription_pix IS
'Se true, o botão Assinar do Booking gera PIX via Mercado Pago (sem cobrança automática). Exclusão mútua com use_pagarme_subscription_pix.';
