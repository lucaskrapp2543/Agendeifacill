-- Script para permitir valores negativos na tabela professional_payments
-- Execute este script no Supabase Dashboard > SQL Editor

-- Remover a restrição que impede valores negativos
ALTER TABLE professional_payments 
DROP CONSTRAINT IF EXISTS professional_payments_amount_check;

-- Adicionar nova restrição que permite valores negativos (para retiradas)
ALTER TABLE professional_payments 
ADD CONSTRAINT professional_payments_amount_check 
CHECK (amount != 0); -- Permite valores positivos e negativos, mas não zero

-- Adicionar comentário explicativo
COMMENT ON COLUMN professional_payments.amount IS 'Valor do pagamento (positivo = pagamento, negativo = retirada)';

-- Verificar se a alteração foi aplicada
SELECT 
  constraint_name, 
  check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name LIKE '%professional_payments%amount%';
