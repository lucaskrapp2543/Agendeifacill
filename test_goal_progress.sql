-- Script para testar a função get_professional_goal_progress
-- Vamos verificar se está filtrando corretamente pelos serviços selecionados

-- 1. Verificar a meta atual do Antonio
SELECT 
    professional_id,
    goal_amount,
    selected_services,
    year,
    month
FROM professional_goals 
WHERE professional_id = '1' 
AND establishment_id = '619f2f1a-17ee-4611-8869-68b2b5ab387e'
ORDER BY updated_at DESC 
LIMIT 1;

-- 2. Verificar agendamentos concluídos do Antonio em setembro 2025
SELECT 
    id,
    client_name,
    service,
    appointment_date,
    appointment_time,
    status
FROM appointments 
WHERE establishment_id = '619f2f1a-17ee-4611-8869-68b2b5ab387e'
AND professional_name = 'Antonio'
AND EXTRACT(YEAR FROM appointment_date::DATE) = 2025
AND EXTRACT(MONTH FROM appointment_date::DATE) = 9
AND status = 'completed'
ORDER BY appointment_date DESC;

-- 3. Testar a função de progresso
SELECT * FROM get_professional_goal_progress(
    '619f2f1a-17ee-4611-8869-68b2b5ab387e'::uuid,
    '1',
    2025,
    9
);

-- 4. Verificar serviços selecionados na meta
SELECT 
    jsonb_array_elements_text(selected_services) as selected_service_id
FROM professional_goals 
WHERE professional_id = '1' 
AND establishment_id = '619f2f1a-17ee-4611-8869-68b2b5ab387e'
ORDER BY updated_at DESC 
LIMIT 1;

-- 5. Verificar se os serviços selecionados correspondem aos agendamentos
SELECT 
    a.service as appointment_service,
    ss.name as subcategory_name,
    ss.id as subcategory_id
FROM appointments a
LEFT JOIN service_subcategories ss ON ss.name = a.service
WHERE a.establishment_id = '619f2f1a-17ee-4611-8869-68b2b5ab387e'
AND a.professional_name = 'Antonio'
AND a.status = 'completed'
AND EXTRACT(YEAR FROM a.appointment_date::DATE) = 2025
AND EXTRACT(MONTH FROM a.appointment_date::DATE) = 9;
