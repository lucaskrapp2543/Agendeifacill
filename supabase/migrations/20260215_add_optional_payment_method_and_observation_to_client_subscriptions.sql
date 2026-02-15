-- Campos opcionais no assinante:
-- 1) Forma de pagamento escolhida pelo cliente
-- 2) Observação livre (até 150 no frontend)

ALTER TABLE client_subscriptions
ADD COLUMN IF NOT EXISTS subscriber_payment_method TEXT;

ALTER TABLE client_subscriptions
ADD COLUMN IF NOT EXISTS subscriber_observation TEXT;

COMMENT ON COLUMN client_subscriptions.subscriber_payment_method IS
'Forma de pagamento escolhida para a assinatura (ex: pix, credito, debito, dinheiro, pagar_local, etc).';

COMMENT ON COLUMN client_subscriptions.subscriber_observation IS
'Observação opcional do assinante (limite de 150 caracteres aplicado no frontend).';

CREATE INDEX IF NOT EXISTS idx_client_subscriptions_subscriber_payment_method
  ON client_subscriptions (subscriber_payment_method);
