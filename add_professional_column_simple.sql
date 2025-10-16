-- Script para adicionar as colunas 'professional' e 'professional_id' à tabela establishment_expenses
-- Execute este script no Supabase Dashboard > SQL Editor

-- Adicionar a coluna professional se ela não existir
ALTER TABLE establishment_expenses 
ADD COLUMN IF NOT EXISTS professional TEXT;

-- Adicionar a coluna professional_id se ela não existir
ALTER TABLE establishment_expenses 
ADD COLUMN IF NOT EXISTS professional_id TEXT;

-- Adicionar comentários
COMMENT ON COLUMN establishment_expenses.professional IS 'Nome do profissional que registrou a despesa';
COMMENT ON COLUMN establishment_expenses.professional_id IS 'ID do profissional que registrou a despesa (para integração com sistema de pagamentos)';

-- Verificar se as colunas foram adicionadas
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'establishment_expenses' 
AND column_name IN ('professional', 'professional_id')
ORDER BY column_name;
