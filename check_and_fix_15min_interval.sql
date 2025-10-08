-- Script para verificar e corrigir a configuração de intervalo de 15 minutos
-- Execute este script no Supabase SQL Editor

-- 1. Primeiro, vamos verificar o valor atual
SELECT 
  id,
  name,
  use_15_minute_interval,
  updated_at
FROM establishments
WHERE owner_id = auth.uid()
ORDER BY created_at DESC
LIMIT 1;

-- 2. Se o valor estiver como TRUE e você quer FALSE, execute este UPDATE:
-- (Descomente a linha abaixo removendo o -- e execute)

-- UPDATE establishments 
-- SET use_15_minute_interval = false
-- WHERE owner_id = auth.uid();

-- 3. Verificar novamente após o UPDATE:
-- SELECT 
--   id,
--   name,
--   use_15_minute_interval,
--   updated_at
-- FROM establishments
-- WHERE owner_id = auth.uid()
-- ORDER BY created_at DESC
-- LIMIT 1;
