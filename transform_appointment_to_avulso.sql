-- Script para transformar um agendamento em CLIENTE AVULSO (para testes)

-- 1. Ver seus agendamentos recentes
SELECT 
  id,
  client_name,
  appointment_date,
  appointment_time,
  is_avulso
FROM appointments
WHERE establishment_id IN (
  SELECT id FROM establishments WHERE owner_id = auth.uid()
)
ORDER BY created_at DESC
LIMIT 10;

-- 2. Transformar um agendamento específico em avulso
-- (Substitua 'ID_DO_AGENDAMENTO' pelo ID real que você quer testar)

-- UPDATE appointments 
-- SET 
--   is_avulso = true,
--   client_name = 'CLIENTE AVULSO'
-- WHERE id = 'ID_DO_AGENDAMENTO'
--   AND establishment_id IN (SELECT id FROM establishments WHERE owner_id = auth.uid());

-- 3. Verificar se funcionou
-- SELECT 
--   id,
--   client_name,
--   is_avulso
-- FROM appointments
-- WHERE id = 'ID_DO_AGENDAMENTO';
