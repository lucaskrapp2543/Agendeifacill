-- Verificar se o campo foi criado
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'establishments' 
AND column_name = 'limit_subscribers_one_week';

-- Verificar o valor atual do estabelecimento
SELECT id, name, limit_subscribers_one_week 
FROM establishments 
WHERE id = 'SEU_ESTABELECIMENTO_ID_AQUI';

-- Verificar agendamentos de assinantes na semana atual
SELECT 
  a.id,
  a.client_id,
  a.appointment_date,
  a.status,
  a.is_subscriber,
  p.full_name as client_name
FROM appointments a
LEFT JOIN profiles p ON p.id = a.client_id
WHERE a.establishment_id = 'SEU_ESTABELECIMENTO_ID_AQUI'
  AND a.is_subscriber = true
  AND a.appointment_date >= date_trunc('week', CURRENT_DATE)
  AND a.appointment_date < date_trunc('week', CURRENT_DATE) + interval '7 days'
ORDER BY a.appointment_date;
