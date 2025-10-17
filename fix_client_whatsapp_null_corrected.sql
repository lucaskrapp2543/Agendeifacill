-- CORRIGIR client_whatsapp NULL na tabela client_subscriptions (CORRIGIDO)
-- Execute este SQL no Supabase SQL Editor

-- 1. Verificar quantos registros têm client_whatsapp NULL
SELECT 
    COUNT(*) as total_client_subscriptions,
    COUNT(CASE WHEN client_whatsapp IS NULL THEN 1 END) as com_whatsapp_null,
    COUNT(CASE WHEN client_whatsapp IS NOT NULL THEN 1 END) as com_whatsapp_preenchido
FROM client_subscriptions;

-- 2. Verificar tipos de dados das colunas
SELECT 
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name IN ('client_subscriptions', 'profiles')
AND column_name IN ('client_id', 'id')
ORDER BY table_name, column_name;

-- 3. Mostrar registros com client_whatsapp NULL (sem JOIN por enquanto)
SELECT 
    cs.id,
    cs.client_id,
    cs.client_whatsapp,
    cs.monthly_service_limit,
    cs.payment_status,
    s.name as subscription_name
FROM client_subscriptions cs
LEFT JOIN subscriptions s ON cs.subscription_id = s.id
WHERE cs.client_whatsapp IS NULL
ORDER BY cs.created_at DESC
LIMIT 10;

-- 4. Verificar se há perfis com IDs que correspondem aos client_id
SELECT 
    COUNT(*) as total_profiles,
    COUNT(CASE WHEN id::text IN (SELECT client_id::text FROM client_subscriptions WHERE client_whatsapp IS NULL) THEN 1 END) as profiles_com_client_subscriptions
FROM profiles;

-- 5. ATUALIZAR client_whatsapp usando o phone do perfil (com cast correto)
UPDATE client_subscriptions 
SET client_whatsapp = (
    SELECT p.phone 
    FROM profiles p 
    WHERE p.id = client_subscriptions.client_id::text
),
updated_at = NOW()
WHERE client_whatsapp IS NULL;

-- 6. Verificar se a atualização funcionou
SELECT 
    COUNT(*) as total_client_subscriptions,
    COUNT(CASE WHEN client_whatsapp IS NULL THEN 1 END) as com_whatsapp_null,
    COUNT(CASE WHEN client_whatsapp IS NOT NULL THEN 1 END) as com_whatsapp_preenchido
FROM client_subscriptions;

-- 7. Mostrar alguns registros atualizados
SELECT 
    cs.id,
    cs.client_id,
    cs.client_whatsapp,
    cs.monthly_service_limit,
    cs.payment_status,
    s.name as subscription_name
FROM client_subscriptions cs
LEFT JOIN subscriptions s ON cs.subscription_id = s.id
WHERE cs.monthly_service_limit IS NOT NULL 
  AND cs.monthly_service_limit != 999
ORDER BY cs.created_at DESC
LIMIT 5;
