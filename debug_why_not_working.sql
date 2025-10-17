-- DEBUG COMPLETO: Por que o limite não está funcionando?
-- Execute este SQL no Supabase SQL Editor

-- 1. Verificar se o WhatsApp foi preenchido corretamente
SELECT 
    cs.id,
    cs.client_id,
    cs.client_whatsapp,
    cs.monthly_service_limit,
    cs.payment_status,
    s.name as subscription_name,
    cs.start_date,
    cs.end_date
FROM client_subscriptions cs
LEFT JOIN subscriptions s ON cs.subscription_id = s.id
WHERE cs.monthly_service_limit = 1
ORDER BY cs.created_at DESC;

-- 2. Verificar se há agendamentos deste mês para esse cliente
SELECT 
    a.id,
    a.client_name,
    a.client_whatsapp,
    a.appointment_date,
    a.status,
    a.is_subscriber,
    a.establishment_id,
    e.name as establishment_name
FROM appointments a
JOIN establishments e ON a.establishment_id = e.id
WHERE a.client_whatsapp IN (
    SELECT cs.client_whatsapp 
    FROM client_subscriptions cs 
    WHERE cs.monthly_service_limit = 1
    AND cs.client_whatsapp IS NOT NULL
)
AND a.appointment_date >= DATE_TRUNC('month', CURRENT_DATE)
AND a.appointment_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
ORDER BY a.appointment_date DESC;

-- 3. Simular exatamente o que a função checkSubscriberMonthlyLimit faz
SELECT 
    cs.id as client_subscription_id,
    cs.client_whatsapp,
    cs.monthly_service_limit,
    cs.payment_status,
    cs.end_date,
    cs.start_date,
    CASE 
        WHEN cs.end_date < CURRENT_DATE THEN 'VENCIDO'
        WHEN cs.start_date > CURRENT_DATE THEN 'AINDA NÃO INICIOU'
        WHEN cs.payment_status = 'unpaid' THEN 'NÃO PAGO'
        ELSE 'ATIVO'
    END as status_assinatura,
    COUNT(a.id) as agendamentos_este_mes,
    CASE 
        WHEN cs.monthly_service_limit = 999 THEN 'SEM LIMITE'
        WHEN COUNT(a.id) < cs.monthly_service_limit THEN 'PODE AGENDAR'
        ELSE 'LIMITE EXCEDIDO'
    END as resultado_limite
FROM client_subscriptions cs
LEFT JOIN appointments a ON a.client_whatsapp = cs.client_whatsapp 
    AND a.is_subscriber = true
    AND a.appointment_date >= DATE_TRUNC('month', CURRENT_DATE)
    AND a.appointment_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
    AND a.status IN ('confirmed', 'completed', 'pending')
WHERE cs.monthly_service_limit = 1
  AND cs.client_whatsapp IS NOT NULL
GROUP BY cs.id, cs.client_whatsapp, cs.monthly_service_limit, cs.payment_status, cs.end_date, cs.start_date;

-- 4. Verificar se o agendamento está sendo criado como is_subscriber = true
SELECT 
    a.id,
    a.client_name,
    a.client_whatsapp,
    a.is_subscriber,
    a.appointment_date,
    a.status,
    a.created_at
FROM appointments a
WHERE a.client_whatsapp IN (
    SELECT cs.client_whatsapp 
    FROM client_subscriptions cs 
    WHERE cs.monthly_service_limit = 1
    AND cs.client_whatsapp IS NOT NULL
)
ORDER BY a.created_at DESC
LIMIT 10;
