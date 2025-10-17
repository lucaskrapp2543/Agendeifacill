-- VERIFICAR ESTRUTURA DA TABELA subscriber_attendances
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'subscriber_attendances'
ORDER BY ordinal_position;

-- VER TODOS OS REGISTROS (SEM FILTRO)
SELECT 
    '=== TODOS SUBSCRIBER ATTENDANCES ===' as debug_info,
    *
FROM subscriber_attendances 
LIMIT 5;
