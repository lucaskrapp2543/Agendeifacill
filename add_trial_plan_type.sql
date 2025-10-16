-- Adicionar opção 'trial' (7 dias) ao campo plan_type
-- Migration: add_trial_plan_type

-- Atualizar a constraint CHECK para incluir 'trial'
ALTER TABLE establishments 
DROP CONSTRAINT IF EXISTS establishments_plan_type_check;

ALTER TABLE establishments 
ADD CONSTRAINT establishments_plan_type_check 
CHECK (plan_type IN ('monthly', 'annual', 'trial'));

-- Comentários para documentação
COMMENT ON COLUMN establishments.plan_type IS 'Tipo de plano: monthly (mensal), annual (anual), trial (7 dias)';
