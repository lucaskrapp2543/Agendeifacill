-- Script para verificar todas as metas salvas

-- 1. Ver todas as metas salvas
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

-- 2. Verificar qual profissional tem ID '2'
SELECT 
    jsonb_array_elements(professionals) as professional
FROM establishments 
WHERE id = '619f2f1a-17ee-4611-8869-68b2b5ab387e';

-- 3. Verificar agendamentos do Joseph
SELECT 
    id,
    client_name,
    service,
    professional_name,
    appointment_date,
    status
FROM appointments 
WHERE establishment_id = '619f2f1a-17ee-4611-8869-68b2b5ab387e'
AND professional_name = 'Joseph'
AND status = 'completed'
ORDER BY appointment_date DESC;
