-- INVESTIGAR PROFISSIONAL 'LUC' ESPECIFICAMENTE
-- Execute este SQL no Supabase SQL Editor

-- 1. BUSCAR TODOS OS AGENDAMENTOS DO PROFISSIONAL 'LUC'
SELECT 
  'AGENDAMENTOS DO PROFISSIONAL LUC' as investigacao,
  id,
  client_name,
  professional,
  appointment_date,
  appointment_time,
  service,
  status,
  establishment_id,
  created_at
FROM appointments 
WHERE professional = 'Luc'
ORDER BY created_at DESC;

-- 2. VERIFICAR SE EXISTE ALGUM PROFISSIONAL COM NOME SIMILAR
SELECT 
  'BUSCAR PROFISSIONAIS COM NOME SIMILAR' as investigacao,
  id,
  name,
  professionals,
  created_at
FROM establishments 
WHERE professionals::text ILIKE '%Luc%'
   OR professionals::text ILIKE '%luc%'
   OR professionals::text ILIKE '%LUC%';

-- 3. BUSCAR AGENDAMENTOS RECENTES PARA VER PADRÃO
SELECT 
  'AGENDAMENTOS RECENTES (últimos 20)' as investigacao,
  id,
  client_name,
  professional,
  appointment_date,
  appointment_time,
  service,
  status,
  establishment_id
FROM appointments 
ORDER BY created_at DESC
LIMIT 20;

-- 4. VERIFICAR SE HÁ PROFISSIONAIS COM ID VAZIO OU NULO
SELECT 
  'VERIFICAR PROFISSIONAIS COM ID PROBLEMÁTICO' as investigacao,
  id,
  name,
  professionals,
  created_at
FROM establishments 
WHERE professionals::text LIKE '%"id":""%'
   OR professionals::text LIKE '%"id":null%'
   OR professionals::text LIKE '%"id":" "%'
ORDER BY created_at DESC;

-- 5. CONTAR AGENDAMENTOS POR PROFISSIONAL
SELECT 
  'CONTAGEM DE AGENDAMENTOS POR PROFISSIONAL' as investigacao,
  professional,
  COUNT(*) as total_agendamentos,
  MIN(appointment_date) as primeiro_agendamento,
  MAX(appointment_date) as ultimo_agendamento,
  COUNT(DISTINCT establishment_id) as estabelecimentos_diferentes
FROM appointments 
WHERE professional IS NOT NULL 
  AND professional != ''
GROUP BY professional
ORDER BY total_agendamentos DESC;

























