-- REMOVER TODA A FUNCIONALIDADE DE PUNIÇÃO AO CANCELAR
-- Execute este script no SQL Editor do Supabase

-- 1. Remover campo de punição por cancelamento
ALTER TABLE establishments 
DROP COLUMN IF EXISTS punish_client_on_cancel;

-- 2. Remover campo de limitação de remarcação no mesmo dia
ALTER TABLE establishments 
DROP COLUMN IF EXISTS prevent_same_day_reschedule;

-- 3. Remover índice relacionado
DROP INDEX IF EXISTS idx_establishments_prevent_same_day_reschedule;

-- 4. Verificar se todos os campos foram removidos
SELECT 
  column_name, 
  data_type
FROM information_schema.columns 
WHERE table_name = 'establishments' 
  AND (column_name LIKE '%punish%' 
       OR column_name LIKE '%prevent%'
       OR column_name LIKE '%penalty%'
       OR column_name LIKE '%cancel%');

-- 5. Confirmar remoção
SELECT 'Toda funcionalidade de punição removida com sucesso!' as status;
