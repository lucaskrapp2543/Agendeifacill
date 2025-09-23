-- Script para verificar se a tabela professional_goals existe e está configurada corretamente

-- 1. Verificar se a tabela existe
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'professional_goals'
ORDER BY ordinal_position;

-- 2. Verificar se há dados na tabela
SELECT COUNT(*) as total_goals FROM professional_goals;

-- 3. Verificar estrutura da tabela
SELECT * FROM professional_goals LIMIT 5;

-- 4. Verificar se a função get_professional_goal_progress existe
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_name = 'get_professional_goal_progress';
