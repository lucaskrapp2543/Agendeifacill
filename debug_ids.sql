-- 🔍 BUSCAR IDs PARA DEBUG
-- 1. Buscar establishment_id
SELECT id, name FROM establishments LIMIT 5;

-- 2. Buscar professional_id do establishment
SELECT 
  e.id as establishment_id,
  e.name as establishment_name,
  prof->>'id' as professional_id,
  prof->>'name' as professional_name
FROM establishments e, 
     unnest(e.professionals) AS prof
WHERE e.name ILIKE '%seu_nome%'  -- Substitua por parte do nome do seu estabelecimento
LIMIT 10;

-- 3. Verificar se tem metas salvas
SELECT * FROM professional_goals 
ORDER BY created_at DESC 
LIMIT 5;

-- 4. Verificar agendamentos recentes
SELECT 
  id,
  service,
  professional,
  status,
  appointment_date
FROM appointments 
WHERE status = 'completed'
ORDER BY appointment_date DESC 
LIMIT 10;
