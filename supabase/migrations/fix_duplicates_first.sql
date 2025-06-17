-- Identificar agendamentos duplicados
WITH duplicates AS (
  SELECT 
    establishment_id,
    professional,
    appointment_date,
    appointment_time,
    COUNT(*) as count,
    array_agg(id) as appointment_ids,
    array_agg(status) as statuses,
    array_agg(created_at) as created_ats
  FROM appointments
  WHERE status != 'cancelled'
  GROUP BY 
    establishment_id,
    professional,
    appointment_date,
    appointment_time
  HAVING COUNT(*) > 1
)
SELECT * FROM duplicates;

-- Manter apenas o agendamento mais recente de cada grupo duplicado e cancelar os outros
WITH duplicates AS (
  SELECT 
    establishment_id,
    professional,
    appointment_date,
    appointment_time,
    array_agg(id ORDER BY created_at DESC) as appointment_ids
  FROM appointments
  WHERE status != 'cancelled'
  GROUP BY 
    establishment_id,
    professional,
    appointment_date,
    appointment_time
  HAVING COUNT(*) > 1
)
UPDATE appointments
SET status = 'cancelled'
WHERE id IN (
  SELECT unnest(appointment_ids[2:]) -- Pega todos exceto o primeiro (mais recente)
  FROM duplicates
); 