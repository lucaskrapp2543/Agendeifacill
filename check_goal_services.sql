-- Script para verificar se os serviços selecionados estão sendo salvos corretamente

-- 1. Verificar a meta mais recente do Antonio
SELECT 
    id,
    professional_id,
    goal_amount,
    selected_services,
    year,
    month,
    updated_at
FROM professional_goals 
WHERE professional_id = '1' 
AND establishment_id = '619f2f1a-17ee-4611-8869-68b2b5ab387e'
ORDER BY updated_at DESC 
LIMIT 1;

-- 2. Verificar se os serviços selecionados existem nas subcategorias
SELECT 
    ss.id as subcategory_id,
    ss.name as subcategory_name,
    sc.name as category_name
FROM service_subcategories ss
JOIN service_categories sc ON ss.category_id = sc.id
WHERE ss.id IN (
    SELECT jsonb_array_elements_text(selected_services)::uuid
    FROM professional_goals 
    WHERE professional_id = '1' 
    AND establishment_id = '619f2f1a-17ee-4611-8869-68b2b5ab387e'
    AND selected_services != '[]'::jsonb
    ORDER BY updated_at DESC 
    LIMIT 1
);

-- 3. Verificar serviços normais do estabelecimento
SELECT 
    jsonb_array_elements(services_with_prices) as service
FROM establishments 
WHERE id = '619f2f1a-17ee-4611-8869-68b2b5ab387e';
