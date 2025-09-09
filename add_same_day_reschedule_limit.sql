-- Adicionar campo para limitar remarcação no mesmo dia
-- Execute este script no SQL Editor do Supabase

-- 1. Adicionar campo prevent_same_day_reschedule na tabela establishments
ALTER TABLE establishments 
ADD COLUMN IF NOT EXISTS prevent_same_day_reschedule BOOLEAN DEFAULT false;

-- 2. Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_establishments_prevent_same_day_reschedule 
ON establishments(prevent_same_day_reschedule);

-- 3. Verificar se o campo foi adicionado
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'establishments' 
  AND column_name = 'prevent_same_day_reschedule';
