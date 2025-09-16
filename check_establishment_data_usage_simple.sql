-- Verificar uso de dados da conta estabelecimento02@gmail.com
-- Versão simplificada - primeiro vamos encontrar o establishment

-- 1. Buscar establishments que podem ser da conta estabelecimento02@gmail.com
-- (vamos buscar por nome ou outros campos que possam identificar)
SELECT 
  id, 
  name, 
  code,
  created_at,
  owner_id
FROM establishments 
WHERE name ILIKE '%estabelecimento02%' 
   OR name ILIKE '%02%'
   OR code = '2020'
ORDER BY created_at DESC;

-- 2. Se encontrarmos o establishment, vamos calcular o uso de dados
-- (substitua 'SEU_ESTABLISHMENT_ID_AQUI' pelo ID encontrado acima)
/*
WITH establishment_data AS (
  SELECT id, name, created_at
  FROM establishments 
  WHERE id = 'SEU_ESTABLISHMENT_ID_AQUI'
),

data_usage AS (
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

SELECT 
  tabela,
  registros,
  tamanho_total,
  ROUND(tamanho_bytes / 1024.0 / 1024.0, 2) as tamanho_mb,
  ROUND(tamanho_bytes / 1024.0, 2) as tamanho_kb
FROM data_usage

UNION ALL

SELECT 
  'TOTAL GERAL' as tabela,
  SUM(registros) as registros,
  pg_size_pretty(SUM(tamanho_bytes)) as tamanho_total,
  ROUND(SUM(tamanho_bytes) / 1024.0 / 1024.0, 2) as tamanho_mb,
  ROUND(SUM(tamanho_bytes) / 1024.0, 2) as tamanho_kb
FROM data_usage;
*/

