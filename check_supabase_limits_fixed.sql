-- VERIFICAR USO ATUAL vs LIMITES DO PLANO (CORRIGIDO)
-- Este SQL mostra exatamente quanto você tem e quanto falta

-- 1. TAMANHO ATUAL DO BANCO vs LIMITE (CORRIGIDO)
SELECT 
    'DATABASE SIZE' as tipo,
    pg_size_pretty(pg_database_size(current_database())) as usado_atual,
    '500 MB' as limite_free,
    '8 GB' as limite_pro,
    ROUND(
        (pg_database_size(current_database())::bigint::numeric / (500 * 1024 * 1024)) * 100, 2
    ) as percentual_free,
    ROUND(
        (pg_database_size(current_database())::bigint::numeric / (8 * 1024 * 1024 * 1024)) * 100, 2
    ) as percentual_pro;

-- 2. ESTATÍSTICAS DETALHADAS POR TABELA
SELECT 
    tablename as tabela,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as tamanho_atual,
    pg_total_relation_size(schemaname||'.'||tablename) as bytes_atual,
    COUNT(*) as total_registros
FROM pg_tables 
WHERE schemaname = 'public'
GROUP BY tablename, schemaname
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 3. CRESCIMENTO RECENTE (últimos 7 dias)
SELECT 
    'appointments' as tabela,
    COUNT(*) as total_geral,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as ultimos_7_dias,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as ultimos_30_dias
FROM appointments
UNION ALL
SELECT 
    'establishment_notifications' as tabela,
    COUNT(*) as total_geral,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as ultimos_7_dias,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as ultimos_30_dias
FROM establishment_notifications;

-- 4. ESTABELECIMENTOS MAIS ATIVOS (mais agendamentos)
SELECT 
    e.name as estabelecimento,
    COUNT(a.id) as total_agendamentos,
    COUNT(CASE WHEN a.created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as agendamentos_30_dias
FROM establishments e
LEFT JOIN appointments a ON e.id = a.establishment_id
GROUP BY e.id, e.name
ORDER BY COUNT(a.id) DESC
LIMIT 10;

-- 5. RESUMO EXECUTIVO (CORRIGIDO)
SELECT 
    'RESUMO GERAL' as categoria,
    pg_size_pretty(pg_database_size(current_database())) as tamanho_total_banco,
    (SELECT COUNT(*) FROM appointments) as total_agendamentos,
    (SELECT COUNT(*) FROM establishments) as total_estabelecimentos,
    (SELECT COUNT(*) FROM establishment_notifications) as total_notificacoes,
    ROUND(
        (pg_database_size(current_database())::bigint::numeric / (500 * 1024 * 1024)) * 100, 2
    ) as percentual_limite_free;

-- 6. VERSÃO SIMPLIFICADA (se ainda der erro)
SELECT 
    'USO ATUAL' as info,
    pg_size_pretty(pg_database_size(current_database())) as tamanho_banco,
    (SELECT COUNT(*) FROM appointments) as total_agendamentos,
    (SELECT COUNT(*) FROM establishments) as total_estabelecimentos;
