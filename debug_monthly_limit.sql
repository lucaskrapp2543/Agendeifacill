-- DEBUG: Verificar se o campo monthly_service_limit está funcionando
-- Execute este SQL no Supabase SQL Editor

-- 1. Verificar se a coluna existe e tem dados
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'subscriptions' 
AND column_name = 'monthly_service_limit';

-- 2. Verificar assinaturas existentes e seus limites
SELECT 
    id,
    name,
    monthly_service_limit,
    created_at
FROM subscriptions 
ORDER BY created_at DESC
LIMIT 10;

-- 3. Verificar se há assinaturas com limite diferente de 999
SELECT 
    COUNT(*) as total_assinaturas,
    COUNT(CASE WHEN monthly_service_limit = 999 THEN 1 END) as sem_limite,
    COUNT(CASE WHEN monthly_service_limit BETWEEN 1 AND 20 THEN 1 END) as com_limite_especifico,
    COUNT(CASE WHEN monthly_service_limit IS NULL THEN 1 END) as com_null
FROM subscriptions;

-- 4. Buscar client_subscriptions ativas
SELECT 
    cs.id,
    cs.client_id,
    cs.establishment_id,
    cs.start_date,
    cs.end_date,
    cs.payment_status,
    s.name as subscription_name,
    s.monthly_service_limit
FROM client_subscriptions cs
JOIN subscriptions s ON cs.subscription_id = s.id
WHERE cs.end_date >= CURRENT_DATE
  AND cs.start_date <= CURRENT_DATE
  AND cs.payment_status = 'paid'
ORDER BY cs.created_at DESC
LIMIT 5;

-- 5. Verificar agendamentos de assinantes neste mês
SELECT 
    a.id,
    a.client_email,
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
