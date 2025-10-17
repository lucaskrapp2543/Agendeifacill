-- CORRIGIR ERRO: Constraint violation na coluna monthly_service_limit
-- Execute este SQL no Supabase SQL Editor

-- 1. PRIMEIRO: Verificar dados existentes que podem estar causando o problema
SELECT 
    id,
    name,
    monthly_service_limit,
    created_at
FROM subscriptions 
WHERE monthly_service_limit IS NULL 
   OR monthly_service_limit < 1 
   OR monthly_service_limit > 20;

-- 2. REMOVER a constraint problemática
ALTER TABLE subscriptions 
DROP CONSTRAINT IF EXISTS subscriptions_monthly_service_limit_check;

-- 3. ATUALIZAR todos os registros existentes para 999 (sem limite)
UPDATE subscriptions 
SET monthly_service_limit = 999 
WHERE monthly_service_limit IS NULL 
   OR monthly_service_limit < 1 
   OR monthly_service_limit > 20;

-- 4. ADICIONAR nova constraint mais flexível
ALTER TABLE subscriptions 
ADD CONSTRAINT subscriptions_monthly_service_limit_check 
CHECK (monthly_service_limit >= 1 AND monthly_service_limit <= 999);

-- 5. VERIFICAR se a correção funcionou
SELECT 
    id,
    name,
    monthly_service_limit,
    created_at
FROM subscriptions 
ORDER BY created_at DESC
LIMIT 10;

-- 6. VERIFICAR a estrutura da coluna
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'subscriptions' 
AND column_name = 'monthly_service_limit';

-- NOTA: 
-- - Valor 999 = sem limite (para assinaturas existentes)
-- - Valores 1-20 = limite específico de serviços por mês
-- - Constraint permite valores de 1 a 999
