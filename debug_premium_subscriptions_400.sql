-- DEBUG: Por que está dando 400 na tabela premium_subscriptions?

-- 1. VERIFICAR SE A TABELA EXISTE
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'premium_subscriptions'
) as tabela_existe;

-- 2. VERIFICAR ESTRUTURA DA TABELA
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'premium_subscriptions'
ORDER BY ordinal_position;

-- 3. VERIFICAR RLS (Row Level Security)
SELECT
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'premium_subscriptions';

-- 4. TENTAR BUSCAR DADOS (teste simples)
SELECT COUNT(*) as total_registros
FROM premium_subscriptions;

-- 5. TENTAR BUSCAR O ASSINANTE ESPECÍFICO (teste direto)
SELECT *
FROM premium_subscriptions
WHERE establishment_id = 'fbba6634-e8f8-4e15-be17-e5a67ee7dea2'
  AND whatsapp = '47999516123'
LIMIT 1;

-- 6. VERIFICAR SE TEM DADOS COM ESSE WHATSAPP
SELECT 
    id,
    establishment_id,
    whatsapp,
    end_date,
    subscription_id
FROM premium_subscriptions
WHERE whatsapp = '47999516123';

