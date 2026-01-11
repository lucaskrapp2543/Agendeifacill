-- Adiciona toggle para usar PIX da Pagar.me no fluxo de assinaturas (sem cobrança automática)
-- Quando true, no Booking o botão "Assinar" abre um modal que gera PIX via Pagar.me.

ALTER TABLE establishments
ADD COLUMN IF NOT EXISTS use_pagarme_subscription_pix BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN establishments.use_pagarme_subscription_pix IS
'Se true, o botão Assinar do Booking gera PIX via Pagar.me (sem cobrança automática).';


