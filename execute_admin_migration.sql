-- Script para adicionar campos de pagamento na tabela establishments
-- Execute este script no Supabase SQL Editor

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

-- Verificar se os campos foram adicionados corretamente
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'establishments' 
  AND column_name IN ('payment_status', 'plan_type', 'payment_due_date')
ORDER BY column_name;

-- Mostrar alguns estabelecimentos com os novos campos
SELECT 
  id,
  name,
  code,
  payment_status,
  plan_type,
  payment_due_date,
  created_at
FROM establishments 
LIMIT 5; 