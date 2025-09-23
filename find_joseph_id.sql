-- Script para encontrar o ID real do Joseph

-- 1. Ver todos os profissionais do estabelecimento
SELECT 
    jsonb_array_elements(professionals) as professional
FROM establishments 
WHERE id = '619f2f1a-17ee-4611-8869-68b2b5ab387e';

-- 2. Ver todas as metas (independente do ID)
SELECT 
    professional_id,
    goal_amount,
    selected_services,
    year,
    month,
    updated_at
FROM professional_goals 
WHERE establishment_id = '619f2f1a-17ee-4611-8869-68b2b5ab387e'
ORDER BY updated_at DESC;

-- 3. Ver agendamentos do Joseph
SELECT 
    professional_name,
    service,
    status,
    appointment_date
FROM appointments 
WHERE establishment_id = '619f2f1a-17ee-4611-8869-68b2b5ab387e'
AND professional_name = 'Joseph'
ORDER BY appointment_date DESC;
