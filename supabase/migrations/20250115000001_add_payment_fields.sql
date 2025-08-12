-- Adicionar campos de pagamento na tabela establishments
ALTER TABLE establishments 
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('paid', 'unpaid', 'expired')),
ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'monthly' CHECK (plan_type IN ('monthly', 'annual')),
ADD COLUMN IF NOT EXISTS payment_due_date TIMESTAMPTZ DEFAULT now();

-- Criar índice para melhor performance nas consultas de pagamento
CREATE INDEX IF NOT EXISTS idx_establishments_payment_status ON establishments(payment_status);
CREATE INDEX IF NOT EXISTS idx_establishments_payment_due_date ON establishments(payment_due_date);

-- Atualizar estabelecimentos existentes com data de vencimento padrão (30 dias a partir da criação)
UPDATE establishments 
SET payment_due_date = created_at + INTERVAL '30 days'
WHERE payment_due_date IS NULL;

-- Comentários para documentação
COMMENT ON COLUMN establishments.payment_status IS 'Status do pagamento: paid, unpaid, expired';
COMMENT ON COLUMN establishments.plan_type IS 'Tipo de plano: monthly, annual';
COMMENT ON COLUMN establishments.payment_due_date IS 'Data de vencimento do pagamento'; 