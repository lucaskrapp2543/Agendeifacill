-- Script para debug dos dados de agendamentos
-- Execute este SQL para verificar se os dados estão sendo salvos corretamente

-- 1. Verificar estrutura da tabela appointments
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'appointments'
ORDER BY ordinal_position;

-- 2. Verificar dados recentes de agendamentos
SELECT 
  id,
  created_at,
  establishment_name,
  service_name,
  professional_name,
  appointment_date,
  appointment_time,
  status,
  payment_method
FROM appointments
ORDER BY created_at DESC
LIMIT 10;

-- 3. Verificar se há agendamentos sem service_name
SELECT COUNT(*) as total_sem_service_name
FROM appointments
WHERE service_name IS NULL OR service_name = '';

-- 4. Verificar se há agendamentos sem professional_name
SELECT COUNT(*) as total_sem_professional_name
FROM appointments
WHERE professional_name IS NULL OR professional_name = '';

-- 5. Verificar dados de um agendamento específico (substitua o ID)
-- SELECT * FROM appointments WHERE id = 'SEU_ID_AQUI';
