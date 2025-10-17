-- CORRIGIR client_whatsapp copiando dos agendamentos (CORRIGIDO)
-- Execute este SQL no Supabase SQL Editor

-- 1. Verificar quantos client_subscriptions têm WhatsApp NULL
SELECT 
    COUNT(*) as total_client_subscriptions,
    COUNT(CASE WHEN client_whatsapp IS NULL THEN 1 END) as com_whatsapp_null,
    COUNT(CASE WHEN client_whatsapp IS NOT NULL THEN 1 END) as com_whatsapp_preenchido
FROM client_subscriptions;

-- 2. Mostrar client_subscriptions que precisam ser corrigidos
SELECT 
    cs.id,
    cs.client_id,
    cs.client_whatsapp,
    cs.monthly_service_limit,
    cs.payment_status
FROM client_subscriptions cs
WHERE cs.client_whatsapp IS NULL
ORDER BY cs.created_at DESC
LIMIT 10;

-- 3. Verificar tipos de dados para entender melhor
SELECT 
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name IN ('client_subscriptions', 'appointments')
AND column_name = 'client_id'
ORDER BY table_name;

-- 4. ATUALIZAR client_whatsapp usando o WhatsApp dos agendamentos (com cast correto)
UPDATE client_subscriptions 
SET client_whatsapp = (
    SELECT a.client_whatsapp 
    FROM appointments a 
    WHERE a.client_id::text = client_subscriptions.client_id::text
    AND a.is_subscriber = true
    AND a.client_whatsapp IS NOT NULL
    ORDER BY a.appointment_date DESC
    LIMIT 1
),
updated_at = NOW()
WHERE client_whatsapp IS NULL
AND EXISTS (
    SELECT 1 
    FROM appointments a 
    WHERE a.client_id::text = client_subscriptions.client_id::text
    AND a.is_subscriber = true
    AND a.client_whatsapp IS NOT NULL
);

-- 5. Verificar se a atualização funcionou
SELECT 
    COUNT(*) as total_client_subscriptions,
    COUNT(CASE WHEN client_whatsapp IS NULL THEN 1 END) as com_whatsapp_null,
    COUNT(CASE WHEN client_whatsapp IS NOT NULL THEN 1 END) as com_whatsapp_preenchido
FROM client_subscriptions;

-- 6. Mostrar client_subscriptions com limite definido e WhatsApp preenchido
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
  AND cs.client_whatsapp IS NOT NULL
ORDER BY cs.created_at DESC
LIMIT 5;

-- 7. Testar se conseguimos encontrar o cliente com limite 1
SELECT 
    cs.id,
    cs.client_id,
    cs.client_whatsapp,
    cs.monthly_service_limit,
    cs.payment_status,
    COUNT(a.id) as agendamentos_este_mes
FROM client_subscriptions cs
LEFT JOIN appointments a ON a.client_id::text = cs.client_id::text 
    AND a.is_subscriber = true
    AND a.appointment_date >= DATE_TRUNC('month', CURRENT_DATE)
    AND a.appointment_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
WHERE cs.monthly_service_limit = 1
  AND cs.client_whatsapp IS NOT NULL
GROUP BY cs.id, cs.client_id, cs.client_whatsapp, cs.monthly_service_limit, cs.payment_status
ORDER BY agendamentos_este_mes DESC;
