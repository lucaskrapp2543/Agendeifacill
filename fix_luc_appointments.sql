-- CORRIGIR AGENDAMENTOS DO PROFISSIONAL 'LUC' ESPECIFICAMENTE
-- Execute este SQL no Supabase SQL Editor

-- 1. VERIFICAR AGENDAMENTOS DO 'LUC' ANTES DA CORREÇÃO
SELECT 
  'AGENDAMENTOS DO LUC ANTES DA CORREÇÃO' as status,
  id,
  client_name,
  professional,
  appointment_date,
  appointment_time,
  service,
  status,
  establishment_id
FROM appointments 
WHERE professional = 'Luc'
ORDER BY appointment_date DESC, appointment_time DESC;

-- 2. OPÇÃO 1: REATRIBUIR PARA O PRIMEIRO PROFISSIONAL DISPONÍVEL
-- (Substitua 'PRIMEIRO_PROFISSIONAL_ID' pelo ID real de um profissional existente)
UPDATE appointments 
SET professional = 'PRIMEIRO_PROFISSIONAL_ID'  -- SUBSTITUA PELO ID REAL
WHERE professional = 'Luc';

-- 3. OPÇÃO 2: MARCAR COMO CANCELADOS (MAIS SEGURO)
-- (Descomente as linhas abaixo se preferir cancelar)
/*
UPDATE appointments 
SET status = 'cancelled',
    observation = COALESCE(observation, '') || ' [CANCELADO: Profissional Luc removido]'
WHERE professional = 'Luc';
*/

-- 4. OPÇÃO 3: DELETAR PERMANENTEMENTE (CUIDADO!)
-- (Descomente as linhas abaixo APENAS se quiser deletar)
/*
DELETE FROM appointments 
WHERE professional = 'Luc';
*/

-- 5. VERIFICAR RESULTADO APÓS CORREÇÃO
SELECT 
  'AGENDAMENTOS APÓS CORREÇÃO' as status,
  COUNT(*) as total_agendamentos_luc
FROM appointments 
WHERE professional = 'Luc';

-- 6. LISTAR TODOS OS PROFISSIONAIS ATUAIS PARA REFERÊNCIA
SELECT 
  'PROFISSIONAIS ATUAIS' as status,
  id,
  name,
  professionals
FROM establishments 
WHERE id = 'SEU_ESTABELECIMENTO_ID'  -- SUBSTITUA PELO ID REAL
LIMIT 1;






