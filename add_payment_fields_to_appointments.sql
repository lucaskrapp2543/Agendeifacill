-- Migração: Adicionar campos de pagamento na tabela appointments
-- Campos para controlar pagamento antecipado

ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
ADD COLUMN IF NOT EXISTS payment_transaction_id TEXT,
ADD COLUMN IF NOT EXISTS payment_method TEXT CHECK (payment_method IN ('pix', 'credit_card', 'debit_card'));

COMMENT ON COLUMN appointments.payment_status IS 'Status do pagamento: pending, paid, failed, refunded';
COMMENT ON COLUMN appointments.payment_transaction_id IS 'ID da transação na Pagar.me';
COMMENT ON COLUMN appointments.payment_method IS 'Método de pagamento utilizado';

-- Atualizar status existente para 'pending' se não tiver payment_status
UPDATE appointments
SET payment_status = 'pending'
WHERE payment_status IS NULL;

-- Verificar se as colunas foram criadas
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'appointments' 
AND column_name IN ('payment_status', 'payment_transaction_id', 'payment_method')
ORDER BY column_name;








