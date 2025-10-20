-- Script SIMPLES para rastrear último acesso baseado em agendamentos
-- Execute este script no Supabase SQL Editor

-- 1. Verificar se existem agendamentos para estabelecimentos
SELECT 
  e.id as establishment_id,
  e.name as establishment_name,
  e.code as establishment_code,
  COUNT(a.id) as total_appointments,
  MAX(a.created_at) as last_appointment_date,
  CASE 
    WHEN MAX(a.created_at) IS NULL THEN 'Nunca teve agendamentos'
    WHEN MAX(a.created_at) > NOW() - INTERVAL '1 hour' THEN 'Online agora'
    WHEN MAX(a.created_at) > NOW() - INTERVAL '24 hours' THEN 'Hoje'
    WHEN MAX(a.created_at) > NOW() - INTERVAL '7 days' THEN 'Esta semana'
    WHEN MAX(a.created_at) > NOW() - INTERVAL '30 days' THEN 'Este mês'
    ELSE 'Inativo há muito tempo'
  END as status_acesso
FROM establishments e
LEFT JOIN appointments a ON e.id = a.establishment_id
WHERE (e.is_deleted = false OR e.is_deleted IS NULL)
GROUP BY e.id, e.name, e.code
ORDER BY last_appointment_date DESC NULLS LAST
LIMIT 20;
