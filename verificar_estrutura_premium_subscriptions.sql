-- VERIFICAR ESTRUTURA DA TABELA premium_subscriptions
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'premium_subscriptions'
ORDER BY ordinal_position;

-- VER TODAS AS ASSINATURAS ANTIGAS (SEM FILTRO)
SELECT 
    '=== TODAS ASSINATURAS ANTIGAS ===' as debug_info,
    *
FROM premium_subscriptions 
LIMIT 5;
