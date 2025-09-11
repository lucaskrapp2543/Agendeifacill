-- SQL ultra simples para descobrir a estrutura
-- Execute este SQL para ver como os profissionais estão armazenados

-- 1. Ver todas as tabelas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 2. Ver estrutura da tabela 'profiles'
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Ver alguns registros da tabela 'profiles'
SELECT * FROM public.profiles LIMIT 5;
