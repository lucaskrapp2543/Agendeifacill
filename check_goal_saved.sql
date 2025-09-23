-- Script para verificar se a meta foi salva no banco de dados

-- 1. Verificar todas as metas salvas
SELECT 
    id,
    establishment_id,
    professional_id,
    goal_amount,
    selected_services,
    year,
    month,
    created_at,
    updated_at
FROM professional_goals 
ORDER BY updated_at DESC 
LIMIT 10;

-- 2. Verificar especificamente a meta do Antonio (professional_id = '1')
SELECT 
    id,
    establishment_id,
    professional_id,
    goal_amount,
    selected_services,
    year,
    month,
    created_at,
    updated_at
FROM professional_goals 
WHERE professional_id = '1'
ORDER BY updated_at DESC;

-- 3. Contar total de metas
SELECT COUNT(*) as total_goals FROM professional_goals;
