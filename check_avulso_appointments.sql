-- Verificar se existem agendamentos avulsos

SELECT 
  id,
  client_name,
  appointment_date,
  appointment_time,
  service,
  price,
  status,
  is_avulso,
  created_at
FROM appointments
WHERE establishment_id IN (
  SELECT id FROM establishments WHERE owner_id = auth.uid()
)
AND is_avulso = true
ORDER BY appointment_date DESC, appointment_time DESC
LIMIT 20;
