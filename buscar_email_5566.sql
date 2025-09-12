-- Buscar o EMAIL do usuário que criou a conta do booking 5566
-- Execute este SQL no Supabase SQL Editor

-- 1. Primeiro, vamos ver o owner_id do estabelecimento 5566
SELECT 
    id,
    name,
    code,
    owner_id,
    created_at
FROM establishments 
WHERE code = '5566';

-- 2. Buscar o EMAIL do proprietário na tabela auth.users
-- Esta é a consulta que vai mostrar o email usado para criar a conta
SELECT 
    id,
    email,
    created_at,
    email_confirmed_at
FROM auth.users 
WHERE id = (
    SELECT owner_id 
    FROM establishments 
    WHERE code = '5566'
);

-- 3. Se não funcionar por permissões, tente esta consulta alternativa
-- que pode mostrar informações do usuário
SELECT 
    u.id,
    u.email,
    u.created_at,
    e.name as establishment_name,
    e.code as establishment_code
FROM auth.users u
JOIN establishments e ON u.id = e.owner_id
WHERE e.code = '5566';

-- 4. Verificar se existe alguma tabela com dados de usuário
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND (table_name LIKE '%user%' OR table_name LIKE '%profile%' OR table_name LIKE '%account%');