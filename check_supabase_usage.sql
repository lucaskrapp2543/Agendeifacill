-- VERIFICAR USO ATUAL DO BANCO DE DADOS
-- Este SQL mostra o tamanho atual das tabelas

-- 1. Tamanho das tabelas principais
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as tamanho_total,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as tamanho_dados,
    pg_total_relation_size(schemaname||'.'||tablename) as bytes_total
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN ('appointments', 'establishments', 'establishment_notifications')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 2. Tamanho total do banco
SELECT 
    pg_size_pretty(pg_database_size(current_database())) as tamanho_banco_total,
    pg_database_size(current_database()) as bytes_banco_total;

-- 3. Tamanho por schema
SELECT 
    schemaname,
    pg_size_pretty(sum(pg_total_relation_size(schemaname||'.'||tablename))) as tamanho_schema,
    sum(pg_total_relation_size(schemaname||'.'||tablename)) as bytes_schema
FROM pg_tables 
GROUP BY schemaname
ORDER BY sum(pg_total_relation_size(schemaname||'.'||tablename)) DESC;

-- 4. Top 10 maiores tabelas
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as tamanho_total,
    pg_total_relation_size(schemaname||'.'||tablename) as bytes_total
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;

-- 5. Estatísticas de crescimento (últimos 30 dias)
SELECT 
    'appointments' as tabela,
    COUNT(*) as total_registros,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as registros_30_dias,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as registros_7_dias
FROM appointments
UNION ALL
SELECT 
    'establishment_notifications' as tabela,
    COUNT(*) as total_registros,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as registros_30_dias,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as registros_7_dias
FROM establishment_notifications;
