-- CORRIGIR client_whatsapp NULL na tabela client_subscriptions
-- Execute este SQL no Supabase SQL Editor

-- 1. Verificar quantos registros têm client_whatsapp NULL
SELECT 
    COUNT(*) as total_client_subscriptions,
    COUNT(CASE WHEN client_whatsapp IS NULL THEN 1 END) as com_whatsapp_null,
    COUNT(CASE WHEN client_whatsapp IS NOT NULL THEN 1 END) as com_whatsapp_preenchido
FROM client_subscriptions;

-- 2. Mostrar registros com client_whatsapp NULL
SELECT 
    cs.id,
    cs.client_id,
    cs.client_whatsapp,
    cs.monthly_service_limit,
    cs.payment_status,
    s.name as subscription_name,
    p.phone as profile_phone
FROM client_subscriptions cs
LEFT JOIN subscriptions s ON cs.subscription_id = s.id
LEFT JOIN profiles p ON cs.client_id = p.id
WHERE cs.client_whatsapp IS NULL
ORDER BY cs.created_at DESC
LIMIT 10;

-- 3. ATUALIZAR client_whatsapp usando o phone do perfil
UPDATE client_subscriptions 
SET client_whatsapp = (
    SELECT p.phone 
    FROM profiles p 
    WHERE p.id = client_subscriptions.client_id
),
updated_at = NOW()
WHERE client_whatsapp IS NULL;

-- 4. Verificar se a atualização funcionou
SELECT 
    COUNT(*) as total_client_subscriptions,
    COUNT(CASE WHEN client_whatsapp IS NULL THEN 1 END) as com_whatsapp_null,
    COUNT(CASE WHEN client_whatsapp IS NOT NULL THEN 1 END) as com_whatsapp_preenchido
FROM client_subscriptions;

-- 5. Mostrar alguns registros atualizados
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
