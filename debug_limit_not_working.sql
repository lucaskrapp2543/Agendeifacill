-- DEBUG: Por que o limite não está funcionando?
-- Execute este SQL no Supabase SQL Editor

-- 1. Verificar se o cliente tem WhatsApp e limite definido
SELECT 
    cs.id,
    cs.client_id,
    cs.client_whatsapp,
    cs.monthly_service_limit,
    cs.payment_status,
    s.name as subscription_name
FROM client_subscriptions cs
LEFT JOIN subscriptions s ON cs.subscription_id = s.id
WHERE cs.monthly_service_limit = 1
  AND cs.client_whatsapp IS NOT NULL
ORDER BY cs.created_at DESC;

-- 2. Verificar agendamentos deste mês do cliente com limite 1
SELECT 
    a.id,
    a.client_name,
    a.client_whatsapp,
    a.appointment_date,
    a.status,
    a.is_subscriber,
    a.client_id,
    e.name as establishment_name
FROM appointments a
JOIN establishments e ON a.establishment_id = e.id
WHERE a.appointment_date >= DATE_TRUNC('month', CURRENT_DATE)
  AND a.appointment_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
  AND a.is_subscriber = true
  AND a.client_whatsapp IN (
    SELECT cs.client_whatsapp 
    FROM client_subscriptions cs 
    WHERE cs.monthly_service_limit = 1
  )
ORDER BY a.appointment_date DESC;

-- 3. Verificar se a função checkMonthlyServiceLimit está sendo chamada
-- (Vamos simular o que a função faz)
SELECT 
    cs.id as client_subscription_id,
    cs.client_whatsapp,
    cs.monthly_service_limit,
    COUNT(a.id) as agendamentos_este_mes,
    CASE 
        WHEN cs.monthly_service_limit = 999 THEN 'Sem limite'
        WHEN COUNT(a.id) < cs.monthly_service_limit THEN 'Pode agendar'
        ELSE 'LIMITE EXCEDIDO'
    END as status
FROM client_subscriptions cs
LEFT JOIN appointments a ON a.client_whatsapp = cs.client_whatsapp 
    AND a.is_subscriber = true
    AND a.appointment_date >= DATE_TRUNC('month', CURRENT_DATE)
    AND a.appointment_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
    AND a.status IN ('confirmed', 'completed', 'pending')
WHERE cs.monthly_service_limit = 1
  AND cs.client_whatsapp IS NOT NULL
GROUP BY cs.id, cs.client_whatsapp, cs.monthly_service_limit;

-- 4. Verificar se o agendamento está sendo criado como is_subscriber = true
SELECT 
    a.id,
    a.client_name,
    a.client_whatsapp,
    a.is_subscriber,
    a.appointment_date,
    a.status
FROM appointments a
WHERE a.client_whatsapp IN (
    SELECT cs.client_whatsapp 
    FROM client_subscriptions cs 
    WHERE cs.monthly_service_limit = 1
)
ORDER BY a.appointment_date DESC
LIMIT 10;
