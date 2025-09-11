-- SQL para verificar se existem profissionais cadastrados
-- Execute este SQL para ver os profissionais disponíveis

-- Ver todos os tipos de usuários na tabela profiles
SELECT type, COUNT(*) as quantidade
FROM public.profiles 
GROUP BY type
ORDER BY type;

-- Ver profissionais cadastrados
SELECT id, name, type, created_at
FROM public.profiles 
WHERE type = 'professional'
ORDER BY name;

-- Ver todos os registros da tabela profiles (para debug)
SELECT id, name, type, is_premium, is_subscriber, created_at
FROM public.profiles 
ORDER BY type, name;
