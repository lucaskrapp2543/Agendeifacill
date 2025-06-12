-- Script para criar agendamentos de teste que causam conflito
-- Execute no SQL Editor do Supabase

-- Primeiro, vamos ver se há dados do Rodrigo Barber
SELECT id, name, code FROM establishments WHERE code = '1010';

-- Inserir agendamentos de teste que demonstram o problema
-- Assumindo que o establishment_id será obtido da query acima

INSERT INTO appointments (
    client_id,
    establishment_id,
    service,
    professional,
    appointment_date,
    appointment_time,
    status,
    client_name,
    price,
    duration
) VALUES 
-- Agendamento às 08:30 (30 min) - vai até 09:00
('00000000-0000-0000-0000-000000000001', 
 (SELECT id FROM establishments WHERE code = '1010' LIMIT 1),
 'Corte Masculino',
 'rodrigo',
 '2025-06-12',  -- Data futura para teste
 '08:30',
 'confirmed',
 'Cliente Teste - Conflito',
 25.00,
 30),

-- Agendamento às 09:00 (45 min) - vai até 09:45
('00000000-0000-0000-0000-000000000002',
 (SELECT id FROM establishments WHERE code = '1010' LIMIT 1),
 'Corte + Barba',
 'rodrigo', 
 '2025-06-12',
 '09:00',
 'confirmed',
 'Cliente Teste - Conflito 2',
 35.00,
 45)
ON CONFLICT DO NOTHING;

-- Verificar os agendamentos criados
SELECT 
    appointment_date,
    appointment_time, 
    duration, 
    service, 
    professional,
    client_name,
    status
FROM appointments 
WHERE appointment_date = '2025-06-12' 
ORDER BY appointment_time;

-- ✅ TESTE ESPERADO:
-- Com esses agendamentos, o horário 07:45 NÃO deveria estar disponível 
-- para um serviço de 45min, porque:
-- 07:45 + 45min = 08:30, que conflita com o agendamento das 08:30

-- O sistema deveria mostrar:
-- ❌ 07:45 - BLOQUEADO (conflita com 08:30)
-- ❌ 08:00 - BLOQUEADO (conflita com 08:30) 
-- ❌ 08:15 - BLOQUEADO (conflita com 08:30)
-- ❌ 08:30 - BLOQUEADO (ocupado)
-- ❌ 08:45 - BLOQUEADO (conflita com 09:00)
-- ❌ 09:00 - BLOQUEADO (ocupado)
-- ✅ 09:45 - DISPONÍVEL 