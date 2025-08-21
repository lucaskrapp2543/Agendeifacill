-- VERIFICAR CONSUMO DE DADOS DOS ESTABELECIMENTOS
-- Este SQL mostra estatísticas de uso do banco de dados

-- 1. Contagem total de registros por tabela
SELECT 
    'appointments' as tabela,
    COUNT(*) as total_registros,
    COUNT(*) * 1000 as bytes_estimados
FROM appointments
UNION ALL
SELECT 
    'establishments' as tabela,
    COUNT(*) as total_registros,
    COUNT(*) * 500 as bytes_estimados
FROM establishments
UNION ALL
SELECT 
    'establishment_notifications' as tabela,
    COUNT(*) as total_registros,
    COUNT(*) * 200 as bytes_estimados
FROM establishment_notifications;

-- 2. Top 10 estabelecimentos com mais agendamentos
SELECT 
    e.name as estabelecimento,
    e.owner_id,
    COUNT(a.id) as total_agendamentos,
    COUNT(CASE WHEN a.status = 'cancelled' THEN 1 END) as agendamentos_cancelados,
    COUNT(CASE WHEN a.status = 'confirmed' THEN 1 END) as agendamentos_confirmados,
    COUNT(a.id) * 1000 as bytes_consumidos_agendamentos
FROM establishments e
LEFT JOIN appointments a ON e.id = a.establishment_id
GROUP BY e.id, e.name, e.owner_id
ORDER BY total_agendamentos DESC
LIMIT 10;

-- 3. Top 10 estabelecimentos com mais notificações
SELECT 
    e.name as estabelecimento,
    e.owner_id,
    COUNT(n.id) as total_notificacoes,
    COUNT(CASE WHEN n.read = false THEN 1 END) as nao_lidas,
    COUNT(CASE WHEN n.read = true THEN 1 END) as lidas,
    COUNT(n.id) * 200 as bytes_consumidos_notificacoes
FROM establishments e
LEFT JOIN establishment_notifications n ON e.id = n.establishment_id
GROUP BY e.id, e.name, e.owner_id
ORDER BY total_notificacoes DESC
LIMIT 10;

-- 4. Estabelecimentos com maior consumo total de dados
SELECT 
    e.name as estabelecimento,
    e.owner_id,
    COUNT(a.id) as total_agendamentos,
    COUNT(n.id) as total_notificacoes,
    (COUNT(a.id) * 1000) + (COUNT(n.id) * 200) as bytes_consumidos_total
FROM establishments e
LEFT JOIN appointments a ON e.id = a.establishment_id
LEFT JOIN establishment_notifications n ON e.id = n.establishment_id
GROUP BY e.id, e.name, e.owner_id
ORDER BY bytes_consumidos_total DESC
LIMIT 10;

-- 5. Estatísticas gerais do banco
SELECT 
    'TOTAL GERAL' as tipo,
    COUNT(DISTINCT e.id) as total_estabelecimentos,
    COUNT(a.id) as total_agendamentos,
    COUNT(n.id) as total_notificacoes,
    (COUNT(a.id) * 1000) + (COUNT(n.id) * 200) as bytes_consumidos_total
FROM establishments e
LEFT JOIN appointments a ON e.id = a.establishment_id
LEFT JOIN establishment_notifications n ON e.id = n.establishment_id;

-- 6. Crescimento por mês (últimos 6 meses)
SELECT 
    DATE_TRUNC('month', a.created_at) as mes,
    COUNT(a.id) as agendamentos_criados,
    COUNT(n.id) as notificacoes_criadas
FROM appointments a
LEFT JOIN establishment_notifications n ON DATE_TRUNC('month', a.created_at) = DATE_TRUNC('month', n.created_at)
WHERE a.created_at >= NOW() - INTERVAL '6 months'
GROUP BY DATE_TRUNC('month', a.created_at)
ORDER BY mes DESC;
