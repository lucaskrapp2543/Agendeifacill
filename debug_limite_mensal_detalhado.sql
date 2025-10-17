-- DEBUG DETALHADO DO LIMITE MENSAL
-- Execute este SQL para ver exatamente o que está acontecendo

-- 1. VERIFICAR SE O CLIENTE TEM ASSINATURA ATIVA
SELECT 
    '=== ASSINATURA DO CLIENTE ===' as debug_info,
    cs.id,
    cs.client_whatsapp,
    cs.start_date,
    cs.end_date,
    cs.payment_status,
    cs.monthly_service_limit,
    s.name as subscription_name,
    CASE 
        WHEN cs.end_date < CURRENT_DATE THEN 'VENCIDA'
        WHEN cs.payment_status = 'unpaid' THEN 'NÃO PAGA'
        ELSE 'ATIVA'
    END as status_assinatura
FROM client_subscriptions cs
LEFT JOIN subscriptions s ON cs.subscription_id = s.id
WHERE cs.client_whatsapp = '48991943444'
AND cs.establishment_id = (
    SELECT id FROM establishments 
    WHERE name ILIKE '%teste%' OR name ILIKE '%vip%' 
    LIMIT 1
);

-- 2. CONTAR AGENDAMENTOS DESTE MÊS
SELECT 
    '=== AGENDAMENTOS DESTE MÊS ===' as debug_info,
    COUNT(*) as total_agendamentos,
    COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmados,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completados,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pendentes,
    COUNT(CASE WHEN is_subscriber = true THEN 1 END) as como_assinante
FROM appointments 
WHERE client_whatsapp = '48991943444'
AND appointment_date >= DATE_TRUNC('month', CURRENT_DATE)
AND appointment_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
AND status IN ('confirmed', 'completed', 'pending');

-- 3. VER TODOS OS AGENDAMENTOS DESTE MÊS (DETALHADO)
SELECT 
    '=== DETALHES DOS AGENDAMENTOS ===' as debug_info,
    id,
    appointment_date,
    status,
    is_subscriber,
    client_whatsapp,
    created_at
FROM appointments 
WHERE client_whatsapp = '48991943444'
AND appointment_date >= DATE_TRUNC('month', CURRENT_DATE)
AND appointment_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
ORDER BY appointment_date DESC;

-- 4. VERIFICAR SE A FUNÇÃO DE VALIDAÇÃO ESTÁ FUNCIONANDO
SELECT 
    '=== TESTE DA LÓGICA DE LIMITE ===' as debug_info,
    CASE 
        WHEN cs.monthly_service_limit = 999 THEN 'SEM LIMITE'
        WHEN cs.monthly_service_limit IS NULL THEN 'LIMITE NULL'
        ELSE cs.monthly_service_limit::text || ' SERVIÇOS'
    END as limite_definido,
    (
        SELECT COUNT(*) 
        FROM appointments 
        WHERE client_whatsapp = cs.client_whatsapp
        AND appointment_date >= DATE_TRUNC('month', CURRENT_DATE)
        AND appointment_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
        AND status IN ('confirmed', 'completed', 'pending')
        AND is_subscriber = true
    ) as agendamentos_este_mes,
    CASE 
        WHEN cs.monthly_service_limit = 999 THEN 'PODE AGENDAR (SEM LIMITE)'
        WHEN cs.monthly_service_limit IS NULL THEN 'PODE AGENDAR (LIMITE NULL)'
        WHEN (
            SELECT COUNT(*) 
            FROM appointments 
            WHERE client_whatsapp = cs.client_whatsapp
            AND appointment_date >= DATE_TRUNC('month', CURRENT_DATE)
            AND appointment_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
            AND status IN ('confirmed', 'completed', 'pending')
            AND is_subscriber = true
        ) >= cs.monthly_service_limit THEN 'BLOQUEADO (LIMITE EXCEDIDO)'
        ELSE 'PODE AGENDAR (DENTRO DO LIMITE)'
    END as resultado_validacao
FROM client_subscriptions cs
WHERE cs.client_whatsapp = '48991943444'
AND cs.establishment_id = (
    SELECT id FROM establishments 
    WHERE name ILIKE '%teste%' OR name ILIKE '%vip%' 
    LIMIT 1
);
