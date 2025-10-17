-- DESCOBRIR qual coluna tem o telefone na tabela profiles
-- Execute este SQL no Supabase SQL Editor

-- 1. Verificar todas as colunas da tabela profiles
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- 2. Verificar se há colunas relacionadas a telefone/WhatsApp
SELECT 
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'profiles'
AND (column_name ILIKE '%phone%' OR column_name ILIKE '%whatsapp%' OR column_name ILIKE '%tel%' OR column_name ILIKE '%cel%');

-- 3. Verificar se há dados na tabela profiles
SELECT COUNT(*) as total_profiles FROM profiles;

-- 4. Mostrar algumas linhas da tabela profiles para ver as colunas
SELECT * FROM profiles LIMIT 3;
