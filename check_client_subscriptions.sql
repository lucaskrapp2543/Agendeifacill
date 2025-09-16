-- Verificar se existe registro na tabela client_subscriptions
SELECT 
  id,
  client_id,
  establishment_id,
  start_date,
  end_date,
  payment_status,
  client_whatsapp,
  subscriber_whatsapp,
  created_at
FROM client_subscriptions 
WHERE client_whatsapp = '48991919191'
OR subscriber_whatsapp = '48991919191'
OR client_id = '483d9669-ac01-41d1-bc79-3b288eb23543';
