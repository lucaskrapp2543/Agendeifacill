-- INVESTIGAR AGENDAMENTOS ÓRFÃOS (sem profissional correspondente)
-- Execute este SQL no Supabase SQL Editor para investigar o problema

-- 1. BUSCAR TODOS OS AGENDAMENTOS COM PROFISSIONAL 'Luc' OU VAZIO
SELECT 
  'AGENDAMENTOS COM PROFISSIONAL LUC OU VAZIO' as investigacao,
  id,
  client_name,
  professional,
  appointment_date,
  appointment_time,
  service,
  status,
  created_at
FROM appointments 
WHERE professional = 'Luc' 
   OR professional = ''
   OR professional IS NULL
ORDER BY created_at DESC;

-- 2. BUSCAR TODOS OS PROFISSIONAIS ÚNICOS NOS AGENDAMENTOS
SELECT 
  'PROFISSIONAIS ÚNICOS NOS AGENDAMENTOS' as investigacao,
  professional,
  COUNT(*) as total_agendamentos
FROM appointments 
WHERE professional IS NOT NULL 
  AND professional != ''
GROUP BY professional
ORDER BY total_agendamentos DESC;

-- 3. BUSCAR AGENDAMENTOS RECENTES PARA VER PADRÃO
SELECT 
  'AGENDAMENTOS RECENTES (últimos 10)' as investigacao,
  id,
  client_name,
  professional,
  appointment_date,
  appointment_time,
  service,
  status
FROM appointments 
ORDER BY created_at DESC
LIMIT 10;

-- 4. VERIFICAR SE HÁ PROFISSIONAIS DUPLICADOS OU INCONSISTENTES
SELECT 
  'VERIFICAR INCONSISTÊNCIAS NOS PROFISSIONAIS' as investigacao,
  professional,
  COUNT(DISTINCT professional) as contagem_distinta,
  COUNT(*) as total_agendamentos,
  MIN(appointment_date) as primeiro_agendamento,
  MAX(appointment_date) as ultimo_agendamento
FROM appointments 
WHERE professional IS NOT NULL 
  AND professional != ''
GROUP BY professional
HAVING COUNT(DISTINCT professional) > 1
ORDER BY total_agendamentos DESC;

-- 5. BUSCAR AGENDAMENTOS DO ESTABELECIMENTO ESPECÍFICO
-- (Substitua 'SEU_ESTABELECIMENTO_ID' pelo ID real do estabelecimento)
SELECT 
  'AGENDAMENTOS DO ESTABELECIMENTO ESPECÍFICO' as investigacao,
  id,
  client_name,
  professional,
  appointment_date,
  appointment_time,
  service,
  status,
  establishment_id
FROM appointments 
WHERE establishment_id = 'SEU_ESTABELECIMENTO_ID'  -- SUBSTITUA PELO ID REAL
ORDER BY appointment_date DESC, appointment_time DESC;





