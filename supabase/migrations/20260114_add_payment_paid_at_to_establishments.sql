-- Registra quando o admin marcou como "Pago" (para métricas mensais no painel admin)
ALTER TABLE establishments
ADD COLUMN IF NOT EXISTS payment_paid_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN establishments.payment_paid_at IS 'Data/hora do último pagamento registrado (quando status vira paid)';

