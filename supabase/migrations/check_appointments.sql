-- Verificar agendamentos existentes às 09:00
SELECT 
  id,
  client_name,
  professional,
  appointment_date,
  appointment_time,
  status,
  created_at
FROM appointments
WHERE 
  appointment_time = '09:00'
  AND status != 'cancelled'
ORDER BY created_at DESC; 