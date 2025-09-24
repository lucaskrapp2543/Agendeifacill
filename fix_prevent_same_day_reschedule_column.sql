-- CORRIGIR COLUNA prevent_same_day_reschedule
-- Execute este script no SQL Editor do Supabase

-- 1. Adicionar coluna prevent_same_day_reschedule na tabela establishments
ALTER TABLE establishments 
ADD COLUMN IF NOT EXISTS prevent_same_day_reschedule BOOLEAN DEFAULT false;

-- 2. Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_establishments_prevent_same_day_reschedule 
ON establishments(prevent_same_day_reschedule);

-- 3. Verificar se a coluna foi adicionada corretamente
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'establishments' 
  AND column_name = 'prevent_same_day_reschedule';

-- 4. Verificar se o índice foi criado
SELECT 
  indexname, 
  tablename, 
  indexdef
FROM pg_indexes 
WHERE tablename = 'establishments' 
  AND indexname = 'idx_establishments_prevent_same_day_reschedule';

-- 5. Testar se a coluna está funcionando
SELECT 
  'Coluna prevent_same_day_reschedule criada com sucesso!' as status,
  id,
  name,
  prevent_same_day_reschedule
FROM establishments 
LIMIT 3;
