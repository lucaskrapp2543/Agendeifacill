-- Script para verificar a estrutura de profissionais no banco
-- Execute este SQL para entender como os profissionais estão armazenados

-- 1. Verificar se existe tabela 'professionals'
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'professionals' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Verificar se existe tabela 'profiles' com role 'professional'
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'profiles' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Buscar profissionais na tabela 'profiles'
SELECT 
    id,
    full_name,
    role,
    establishment_id
FROM public.profiles 
WHERE role = 'professional'
LIMIT 10;

-- 4. Buscar profissionais na tabela 'professionals' (se existir)
SELECT 
    id,
    name,
    establishment_id
FROM public.professionals 
LIMIT 10;

-- 5. Verificar todas as tabelas que podem conter profissionais
SELECT 
    table_name
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_name LIKE '%professional%'
    OR table_name LIKE '%profile%'
    OR table_name LIKE '%user%'
    OR table_name LIKE '%staff%'
    OR table_name LIKE '%employee%'
ORDER BY table_name;
