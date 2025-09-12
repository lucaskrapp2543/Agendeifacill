-- Buscar dados do estabelecimento 5566 de forma simples
-- Execute este SQL no Supabase SQL Editor

-- 1. Buscar o estabelecimento com código 5566
SELECT 
    id,
    name,
    code,
    owner_id,
    created_at
FROM establishments 
WHERE code = '5566';

-- 2. Listar todas as colunas da tabela establishments para ver a estrutura
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'establishments' 
ORDER BY ordinal_position;

-- 3. Verificar se existe tabela profiles e suas colunas
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
ORDER BY ordinal_position;

-- 4. Buscar informações do usuário na tabela auth.users (pode não funcionar por permissões)
-- SELECT id, email FROM auth.users WHERE id = (SELECT owner_id FROM establishments WHERE code = '5566');

