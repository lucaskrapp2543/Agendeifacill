-- Script para corrigir IDs de assinantes inválidos
-- Remove registros com client_id que não são UUIDs válidos

-- 1. Verificar registros problemáticos (convertendo UUID para texto)
SELECT 
  id,
  client_id::text,
  subscriber_name,
  subscriber_whatsapp,
  created_at
FROM client_subscriptions 
WHERE client_id::text NOT LIKE '%-%-%-%-%' 
  AND client_id::text NOT LIKE 'manual_%'
ORDER BY created_at DESC;

-- 2. Atualizar registros com client_id inválido para UUID válido
-- (Apenas execute se houver registros problemáticos)
UPDATE client_subscriptions 
SET client_id = gen_random_uuid()
WHERE client_id::text NOT LIKE '%-%-%-%-%' 
  AND client_id::text NOT LIKE 'manual_%';

-- 3. Verificar se ainda há problemas
SELECT 
  id,
  client_id::text,
  subscriber_name,
  subscriber_whatsapp,
  created_at
FROM client_subscriptions 
WHERE client_id::text NOT LIKE '%-%-%-%-%' 
  AND client_id::text NOT LIKE 'manual_%'
ORDER BY created_at DESC;

-- 4. Verificar agendamentos que podem ter client_id problemático
SELECT 
  id,
  client_id::text,
  client_name,
  appointment_date,
  created_at
FROM appointments 
WHERE client_id::text NOT LIKE '%-%-%-%-%' 
  AND client_id::text NOT LIKE 'manual_%'
ORDER BY created_at DESC;

-- 5. Atualizar agendamentos com client_id inválido
UPDATE appointments 
SET client_id = gen_random_uuid()
WHERE client_id::text NOT LIKE '%-%-%-%-%' 
  AND client_id::text NOT LIKE 'manual_%';

-- 6. Verificar se todos os client_id agora são válidos
SELECT 
  'client_subscriptions' as tabela,
  COUNT(*) as total_registros,
  COUNT(CASE WHEN client_id::text LIKE '%-%-%-%-%' THEN 1 END) as uuids_validos,
  COUNT(CASE WHEN client_id::text LIKE 'manual_%' THEN 1 END) as manual_ids,
  COUNT(CASE WHEN client_id::text NOT LIKE '%-%-%-%-%' AND client_id::text NOT LIKE 'manual_%' THEN 1 END) as ids_invalidos
FROM client_subscriptions

UNION ALL

SELECT 
  'appointments' as tabela,
  COUNT(*) as total_registros,
  COUNT(CASE WHEN client_id::text LIKE '%-%-%-%-%' THEN 1 END) as uuids_validos,
  COUNT(CASE WHEN client_id::text LIKE 'manual_%' THEN 1 END) as manual_ids,
  COUNT(CASE WHEN client_id::text NOT LIKE '%-%-%-%-%' AND client_id::text NOT LIKE 'manual_%' THEN 1 END) as ids_invalidos
FROM appointments;
