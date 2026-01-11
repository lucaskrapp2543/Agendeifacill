-- Garantir colunas do "novo sistema de assinantes" em client_subscriptions
-- (Booking público precisa gravar nome/whatsapp/email do assinante)

ALTER TABLE client_subscriptions
ADD COLUMN IF NOT EXISTS subscriber_name TEXT,
ADD COLUMN IF NOT EXISTS subscriber_whatsapp TEXT,
ADD COLUMN IF NOT EXISTS subscriber_email TEXT;

CREATE INDEX IF NOT EXISTS idx_client_subscriptions_subscriber_whatsapp
ON client_subscriptions (subscriber_whatsapp);

COMMENT ON COLUMN client_subscriptions.subscriber_name IS 'Nome do assinante (para fluxo sem auth)';
COMMENT ON COLUMN client_subscriptions.subscriber_whatsapp IS 'WhatsApp do assinante (para fluxo sem auth)';
COMMENT ON COLUMN client_subscriptions.subscriber_email IS 'Email do assinante (opcional)';


