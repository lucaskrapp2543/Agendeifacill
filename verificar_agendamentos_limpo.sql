-- VERIFICAR AGENDAMENTOS DO CLIENTE 47999516123
-- Execute este SQL para ver quantos agendamentos ele fez

-- 1. Contar agendamentos como assinante no mês atual
SELECT 
    COUNT(*) as total_agendamentos_mes_atual,
    'Agendamentos como assinante em outubro 2025' as descricao
FROM appointments
WHERE establishment_id = 'fbba6634-e8f8-4e15-be17-e5a67ee7dea2'
  AND client_whatsapp = '47999516123'
  AND is_subscriber = true
  AND appointment_date >= '2025-10-01'
  AND appointment_date < '2025-11-01'
  AND status IN ('confirmed', 'completed', 'pending');

-- 2. Ver todos os agendamentos deste cliente (detalhado)
SELECT 
    id,
    appointment_date,
    appointment_time,
    is_subscriber,
    status,
    created_at
FROM appointments
WHERE establishment_id = 'fbba6634-e8f8-4e15-be17-e5a67ee7dea2'
  AND client_whatsapp = '47999516123'
  AND appointment_date >= '2025-10-01'
  AND appointment_date < '2025-11-01'
ORDER BY appointment_date DESC, appointment_time DESC;
