-- Script para testar o salvamento de meta diretamente

-- 1. Primeiro, vamos inserir uma meta de teste
INSERT INTO professional_goals (
    establishment_id,
    professional_id,
    goal_amount,
    selected_services,
    year,
    month
) VALUES (
    '619f2f1a-17ee-4611-8869-68b2b5ab387e', -- ID do seu estabelecimento
    '1', -- ID do Antonio
    60, -- Meta de 60 serviços
    '["service_1", "service_2"]'::jsonb, -- Serviços selecionados
    2025, -- Ano
    9 -- Setembro
) 
ON CONFLICT (establishment_id, professional_id, year, month) 
DO UPDATE SET 
    goal_amount = EXCLUDED.goal_amount,
    selected_services = EXCLUDED.selected_services,
    updated_at = NOW();

-- 2. Verificar se foi inserida/atualizada
SELECT 
    id,
    establishment_id,
    professional_id,
    goal_amount,
    selected_services,
    year,
    month,
    created_at,
    updated_at
FROM professional_goals 
WHERE professional_id = '1' 
AND establishment_id = '619f2f1a-17ee-4611-8869-68b2b5ab387e'
AND year = 2025 
AND month = 9;
