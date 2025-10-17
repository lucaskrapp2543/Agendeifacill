-- VERIFICAR ESTRUTURA DA TABELA premium_subscriptions
-- Execute este SQL para ver quais colunas existem

-- 1. Ver todas as colunas da tabela premium_subscriptions
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'premium_subscriptions'
ORDER BY ordinal_position;

-- 2. Buscar assinante específico (SEM filtro is_paid)
SELECT *
FROM premium_subscriptions
WHERE establishment_id = 'fbba6634-e8f8-4e15-be17-e5a67ee7dea2'
  AND whatsapp = '47999516123'
LIMIT 10;

