-- Link de pagamento para envio de cobrança via WhatsApp (admin)
ALTER TABLE establishments
ADD COLUMN IF NOT EXISTS admin_payment_link TEXT DEFAULT NULL;

COMMENT ON COLUMN establishments.admin_payment_link IS 'Link de pagamento usado pelo admin ao enviar cobrança';

