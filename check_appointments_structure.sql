-- Verificar a estrutura da tabela appointments
-- Execute este SQL no Supabase SQL Editor

-- 1. Verificar colunas da tabela appointments
SELECT 'Colunas da tabela appointments:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'appointments' 
ORDER BY ordinal_position;

-- 2. Verificar algumas linhas de exemplo
SELECT 'Exemplos de dados na tabela appointments:' as info;
SELECT * FROM appointments LIMIT 3;

-- 3. Verificar se existe coluna 'professional' ou similar
SELECT 'Verificando colunas com "professional":' as info;
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'appointments' 
AND column_name LIKE '%professional%';























