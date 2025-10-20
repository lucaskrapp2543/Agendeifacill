-- Script para testar o último acesso dos estabelecimentos no ADMIN
-- Execute este script no Supabase SQL Editor

-- 1. Verificar se existem agendamentos para estabelecimentos
SELECT 
  e.id as establishment_id,
  e.name as establishment_name,
  e.code as establishment_code,
  COUNT(a.id) as total_appointments,
  MAX(a.created_at) as last_appointment_date
FROM establishments e
LEFT JOIN appointments a ON e.id = a.establishment_id
WHERE e.is_deleted = false OR e.is_deleted IS NULL
GROUP BY e.id, e.name, e.code
ORDER BY last_appointment_date DESC NULLS LAST
LIMIT 10;

-- 2. Verificar estabelecimentos que nunca tiveram agendamentos
SELECT 
  e.id as establishment_id,
  e.name as establishment_name,
  e.code as establishment_code,
  e.created_at as establishment_created_at,
  'Nunca teve agendamentos' as status
FROM establishments e
LEFT JOIN appointments a ON e.id = a.establishment_id
WHERE a.id IS NULL 
  AND (e.is_deleted = false OR e.is_deleted IS NULL)
ORDER BY e.created_at DESC
LIMIT 5;

-- 3. Testar a função que será usada no AdminDashboard
SELECT 
  e.id,
  e.name,
  e.code,
  (
    SELECT MAX(created_at) 
    FROM appointments 
    WHERE establishment_id = e.id
  ) as last_access
FROM establishments e
WHERE (e.is_deleted = false OR e.is_deleted IS NULL)
ORDER BY last_access DESC NULLS LAST
LIMIT 10;
