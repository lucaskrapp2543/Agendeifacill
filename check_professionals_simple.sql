-- SQL simples para verificar profissionais
-- Execute este SQL para ver se existem profissionais cadastrados

-- Ver todos os tipos de usuários
SELECT type, COUNT(*) as quantidade
FROM public.profiles 
GROUP BY type
ORDER BY type;

-- Ver profissionais cadastrados
SELECT id, name, type, created_at
FROM public.profiles 
WHERE type = 'professional'
ORDER BY name;

-- Se não aparecer nenhum profissional, execute este SQL para criar alguns de teste:
-- INSERT INTO public.profiles (name, type) VALUES 
-- ('João Silva', 'professional'),
-- ('Maria Santos', 'professional'),
-- ('Pedro Costa', 'professional');
