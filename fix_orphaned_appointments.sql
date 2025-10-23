-- CORRIGIR AGENDAMENTOS ÓRFÃOS (sem profissional correspondente)
-- Execute este SQL no Supabase SQL Editor para corrigir o problema

-- 1. PRIMEIRO: VERIFICAR QUANTOS AGENDAMENTOS ÓRFÃOS EXISTEM
SELECT 
  'AGENDAMENTOS ÓRFÃOS ENCONTRADOS' as status,
  professional,
  COUNT(*) as total_agendamentos,
  MIN(appointment_date) as primeiro_agendamento,
  MAX(appointment_date) as ultimo_agendamento
FROM appointments 
WHERE professional IS NOT NULL 
  AND professional != ''
  AND professional NOT IN (
    -- Lista de profissionais válidos (substitua pelos IDs/nomes reais dos seus profissionais)
    'PROFISSIONAL_1_ID',
    'PROFISSIONAL_2_ID',
    'PROFISSIONAL_3_ID'
    -- Adicione todos os IDs/nomes dos seus profissionais atuais aqui
  )
GROUP BY professional
ORDER BY total_agendamentos DESC;

-- 2. OPÇÃO A: REATRIBUIR AGENDAMENTOS ÓRFÃOS PARA UM PROFISSIONAL EXISTENTE
-- (Substitua 'PROFISSIONAL_EXISTENTE_ID' pelo ID de um profissional que existe)
UPDATE appointments 
SET professional = 'PROFISSIONAL_EXISTENTE_ID'  -- SUBSTITUA PELO ID REAL
WHERE professional = 'Luc'
   OR professional = ''
   OR professional IS NULL;

-- 3. OPÇÃO B: MARCAR AGENDAMENTOS ÓRFÃOS COMO CANCELADOS
-- (Descomente as linhas abaixo se preferir cancelar em vez de reatribuir)
/*
UPDATE appointments 
SET status = 'cancelled',
    observation = COALESCE(observation, '') || ' [CANCELADO: Profissional removido]'
WHERE professional = 'Luc'
   OR (professional IS NOT NULL 
       AND professional != ''
       AND professional NOT IN (
           -- Lista de profissionais válidos
           'PROFISSIONAL_1_ID',
           'PROFISSIONAL_2_ID',
           'PROFISSIONAL_3_ID'
       ));
*/

-- 4. OPÇÃO C: DELETAR AGENDAMENTOS ÓRFÃOS (CUIDADO!)
-- (Descomente as linhas abaixo APENAS se quiser deletar permanentemente)
/*
DELETE FROM appointments 
WHERE professional = 'Luc'
   OR (professional IS NOT NULL 
       AND professional != ''
       AND professional NOT IN (
           -- Lista de profissionais válidos
           'PROFISSIONAL_1_ID',
           'PROFISSIONAL_2_ID',
           'PROFISSIONAL_3_ID'
       ));
*/

-- 5. VERIFICAR RESULTADO APÓS CORREÇÃO
SELECT 
  'VERIFICAÇÃO APÓS CORREÇÃO' as status,
  professional,
  COUNT(*) as total_agendamentos
FROM appointments 
GROUP BY professional
ORDER BY total_agendamentos DESC;













