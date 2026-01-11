-- Rastrear origem do pagamento da assinatura (para calcular "Saldo (assinantes)" corretamente)
-- Ex: subscription_payment_provider = 'pagarme_pix' quando o cliente paga pelo PIX gerado no Booking.

ALTER TABLE client_subscriptions
ADD COLUMN IF NOT EXISTS subscription_payment_provider TEXT,
ADD COLUMN IF NOT EXISTS subscription_payment_order_id TEXT;

CREATE INDEX IF NOT EXISTS idx_client_subscriptions_payment_provider
ON client_subscriptions (subscription_payment_provider);

CREATE INDEX IF NOT EXISTS idx_client_subscriptions_payment_order_id
ON client_subscriptions (subscription_payment_order_id);

COMMENT ON COLUMN client_subscriptions.subscription_payment_provider IS 'Origem do pagamento da assinatura (ex: pagarme_pix, manual, cakto_link)';
COMMENT ON COLUMN client_subscriptions.subscription_payment_order_id IS 'Order ID (Pagar.me) usado no pagamento da assinatura, quando aplicável.';


