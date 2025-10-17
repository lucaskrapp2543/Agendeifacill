-- Adicionar campo "Limite de serviços por mês" na tabela subscriptions
-- Execute este SQL no Supabase SQL Editor

-- 1. Adicionar a coluna monthly_service_limit na tabela subscriptions
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS monthly_service_limit INTEGER DEFAULT 999 CHECK (monthly_service_limit >= 1 AND monthly_service_limit <= 20);

-- 2. Adicionar comentário explicativo na coluna
COMMENT ON COLUMN subscriptions.monthly_service_limit IS 'Limite de serviços que um cliente assinante pode realizar por mês (1-20). Se NULL ou 999, significa sem limite.';

-- 3. Verificar se a coluna foi adicionada corretamente
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'subscriptions' 
AND column_name = 'monthly_service_limit';

-- 4. Atualizar registros existentes para ter limite padrão (999 = sem limite)
UPDATE subscriptions 
SET monthly_service_limit = 999 
WHERE monthly_service_limit IS NULL;

-- 5. Verificar se a atualização funcionou
SELECT 
    id,
    name,
    monthly_service_limit,
    created_at
FROM subscriptions 
LIMIT 5;

-- NOTA: O valor 999 representa "sem limite" para assinaturas existentes
-- Novos tipos de assinatura poderão definir limites de 1 a 20
