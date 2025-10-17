-- VERIFICAR SE O LIMITE FOI SALVO CORRETAMENTE

-- 1. Ver o assinante no banco
SELECT 
    id,
    client_whatsapp,
    subscription_id,
    start_date,
    end_date,
    payment_status,
    monthly_limit,
    created_at,
    updated_at
FROM client_subscriptions
WHERE client_whatsapp = '47999516123'
  AND establishment_id = 'fbba6634-e8f8-4e15-be17-e5a67ee7dea2';

-- 2. Ver todos os assinantes deste estabelecimento
SELECT 
    id,
    client_whatsapp,
    monthly_limit,
    payment_status
FROM client_subscriptions
WHERE establishment_id = 'fbba6634-e8f8-4e15-be17-e5a67ee7dea2';

-- 3. Verificar se a coluna monthly_limit existe
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'client_subscriptions'
  AND column_name = 'monthly_limit';

