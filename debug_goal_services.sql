-- Script para debugar exatamente quais serviços estão selecionados na meta

-- 1. Verificar serviços selecionados na meta do Joseph
SELECT 
    professional_id,
    goal_amount,
    selected_services,
    year,
    month,
    updated_at
FROM professional_goals 
WHERE professional_id = '2'  -- Joseph
AND establishment_id = '619f2f1a-17ee-4611-8869-68b2b5ab387e'
ORDER BY updated_at DESC 
LIMIT 1;

-- 2. Verificar agendamento do Joseph
SELECT 
    id,
    client_name,
    service,
    professional_name,
    appointment_date,
    appointment_time,
    status
FROM appointments 
WHERE establishment_id = '619f2f1a-17ee-4611-8869-68b2b5ab387e'
AND professional_name = 'Joseph'
AND EXTRACT(YEAR FROM appointment_date::DATE) = 2025
AND EXTRACT(MONTH FROM appointment_date::DATE) = 9
AND status = 'completed'
ORDER BY appointment_date DESC;

-- 3. Verificar se "barba 1" está nas subcategorias selecionadas
SELECT 
    ss.id,
    ss.name,
    ss.category_id,
    sc.name as category_name
FROM service_subcategories ss
JOIN service_categories sc ON ss.category_id = sc.id
WHERE ss.name = 'barba 1'
AND sc.establishment_id = '619f2f1a-17ee-4611-8869-68b2b5ab387e';

-- 4. Verificar se "barba 1" está nos serviços normais
SELECT 
    jsonb_array_elements(services_with_prices) as service
FROM establishments 
WHERE id = '619f2f1a-17ee-4611-8869-68b2b5ab387e'
AND jsonb_array_elements(services_with_prices)->>'name' = 'barba 1';

-- 5. Testar a função atual
SELECT * FROM get_professional_goal_progress(
    '619f2f1a-17ee-4611-8869-68b2b5ab387e'::uuid,
    '2',  -- Joseph
    2025,
    9
);
