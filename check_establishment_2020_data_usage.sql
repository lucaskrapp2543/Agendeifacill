-- Verificar uso de dados do establishment código 2020
-- Este SQL vai mostrar o tamanho exato em MB/KB usado

WITH establishment_data AS (
  SELECT id, name, code, created_at
  FROM establishments 
  WHERE code = '2020'
),

data_usage AS (
  SELECT 
    'establishments' as tabela,
    COUNT(*) as registros,
    pg_size_pretty(pg_total_relation_size('establishments')) as tamanho_total,
    pg_total_relation_size('establishments') as tamanho_bytes
  FROM establishments e
  JOIN establishment_data ed ON e.id = ed.id
  
  UNION ALL
  
  SELECT 
    'appointments' as tabela,
    COUNT(*) as registros,
    pg_size_pretty(pg_total_relation_size('appointments')) as tamanho_total,
    pg_total_relation_size('appointments') as tamanho_bytes
  FROM appointments a
  JOIN establishment_data ed ON a.establishment_id = ed.id
  
  UNION ALL
  
  SELECT 
    'client_subscriptions' as tabela,
    COUNT(*) as registros,
    pg_size_pretty(pg_total_relation_size('client_subscriptions')) as tamanho_total,
    pg_total_relation_size('client_subscriptions') as tamanho_bytes
  FROM client_subscriptions cs
  JOIN establishment_data ed ON cs.establishment_id = ed.id
  
  UNION ALL
  
  SELECT 
    'subscriptions' as tabela,
    COUNT(*) as registros,
    pg_size_pretty(pg_total_relation_size('subscriptions')) as tamanho_total,
    pg_total_relation_size('subscriptions') as tamanho_bytes
  FROM subscriptions s
  JOIN establishment_data ed ON s.establishment_id = ed.id
  
  UNION ALL
  
  SELECT 
    'professionals' as tabela,
    COUNT(*) as registros,
    pg_size_pretty(pg_total_relation_size('professionals')) as tamanho_total,
    pg_total_relation_size('professionals') as tamanho_bytes
  FROM professionals p
  JOIN establishment_data ed ON p.establishment_id = ed.id
)

-- Resultado final com total
SELECT 
  tabela,
  registros,
  tamanho_total,
  tamanho_bytes,
  ROUND(tamanho_bytes / 1024.0 / 1024.0, 2) as tamanho_mb,
  ROUND(tamanho_bytes / 1024.0, 2) as tamanho_kb
FROM data_usage

UNION ALL

-- Total geral
SELECT 
  'TOTAL GERAL' as tabela,
  SUM(registros) as registros,
  pg_size_pretty(SUM(tamanho_bytes)) as tamanho_total,
  SUM(tamanho_bytes) as tamanho_bytes,
  ROUND(SUM(tamanho_bytes) / 1024.0 / 1024.0, 2) as tamanho_mb,
  ROUND(SUM(tamanho_bytes) / 1024.0, 2) as tamanho_kb
FROM data_usage;




















