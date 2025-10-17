-- DEBUG: Verificar se o limite está funcionando
-- Execute este SQL no Supabase SQL Editor

-- 1. Verificar se a coluna foi criada corretamente
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'client_subscriptions' 
AND column_name = 'monthly_service_limit';

-- 2. Verificar TODAS as tabelas de assinantes que existem
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND (table_name LIKE '%subscriber%' OR table_name LIKE '%subscription%')
ORDER BY table_name;

-- 3. Verificar se há dados na client_subscriptions
SELECT 
    COUNT(*) as total_client_subscriptions,
    COUNT(CASE WHEN monthly_service_limit IS NULL THEN 1 END) as com_null,
    COUNT(CASE WHEN monthly_service_limit = 999 THEN 1 END) as sem_limite,
    COUNT(CASE WHEN monthly_service_limit BETWEEN 1 AND 20 THEN 1 END) as com_limite_especifico
FROM client_subscriptions;

-- 4. Verificar se há dados na tabela subscriber_attendances (sistema novo)
SELECT 
    COUNT(*) as total_subscriber_attendances
FROM subscriber_attendances;

-- 5. Verificar se há dados na tabela premium_subscriptions
SELECT 
    COUNT(*) as total_premium_subscriptions
FROM premium_subscriptions;

-- 6. MOSTRAR alguns registros de client_subscriptions com limite
SELECT 
    cs.id,
    cs.client_id,
    cs.monthly_service_limit,
    cs.created_at,
    cs.payment_status,
    s.name as subscription_name
FROM client_subscriptions cs
LEFT JOIN subscriptions s ON cs.subscription_id = s.id
ORDER BY cs.created_at DESC
LIMIT 10;

-- 7. Verificar agendamentos de hoje deste mês
SELECT 
    a.id,
    a.client_email,
    a.client_name,
    a.appointment_date,
    a.status,
    a.is_subscriber,
    e.name as establishment_name
FROM appointments a
JOIN establishments e ON a.establishment_id = e.id
WHERE a.appointment_date >= DATE_TRUNC('month', CURRENT_DATE)
  AND a.appointment_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
  AND a.is_subscriber = true
ORDER BY a.appointment_date DESC
LIMIT 10;
