-- SQL para verificar como os profissionais estão relacionados com estabelecimentos
-- Execute este SQL para entender a estrutura

-- 1. Ver todas as tabelas que podem relacionar profissionais com estabelecimentos
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND (table_name LIKE '%professional%' 
         OR table_name LIKE '%establishment%'
         OR table_name LIKE '%staff%'
         OR table_name LIKE '%employee%')
ORDER BY table_name;

-- 2. Ver estrutura da tabela establishments
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'establishments' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Ver alguns registros da tabela establishments
SELECT id, name, user_id FROM public.establishments LIMIT 5;

-- 4. Ver todos os profissionais cadastrados
SELECT id, name, type, user_id FROM public.profiles WHERE type = 'professional';

-- 5. Verificar se existe tabela establishment_professionals
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'establishment_professionals' 
    AND table_schema = 'public'
ORDER BY ordinal_position;
