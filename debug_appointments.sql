-- Verificar todos os agendamentos do cliente 48991363636
SELECT 
    id,
    client_whatsapp,
    appointment_date,
    status,
    created_at,
    is_subscriber,
    establishment_id
FROM appointments 
WHERE establishment_id = '619f2f1a-17ee-4611-8869-68b2b5ab387e'
AND client_whatsapp LIKE '%48991363636%'
ORDER BY created_at DESC
LIMIT 10;
