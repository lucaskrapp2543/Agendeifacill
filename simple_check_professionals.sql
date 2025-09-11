-- SQL simples para descobrir a estrutura dos profissionais
-- Execute este SQL para ver como os profissionais estão armazenados

-- 1. Ver todas as tabelas que podem ter profissionais
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 2. Ver estrutura da tabela 'profiles' (se existir)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Ver estrutura da tabela 'professionals' (se existir)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'professionals' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. Ver alguns registros da tabela 'profiles' (se existir)
SELECT * FROM public.profiles LIMIT 5;

-- 5. Ver alguns registros da tabela 'professionals' (se existir)
SELECT * FROM public.professionals LIMIT 5;
