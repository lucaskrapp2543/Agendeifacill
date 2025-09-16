-- Verificar quais tabelas de assinantes existem no banco
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%subscriber%' 
OR table_name LIKE '%subscription%';

-- Verificar se existe assinante com esse WhatsApp na tabela client_subscriptions
SELECT 
  cs.id,
  cs.client_id,
  cs.subscription_id,
  cs.establishment_id,
  cs.start_date,
  cs.end_date,
  cs.payment_status,
  cs.created_at,
  s.name as subscription_name,
  s.value as subscription_value
FROM client_subscriptions cs
LEFT JOIN subscriptions s ON cs.subscription_id = s.id
WHERE cs.client_id IN (
  SELECT id FROM auth.users 
  WHERE raw_user_meta_data->>'whatsapp' = '48991919191'
  OR id IN (
    SELECT id FROM profiles 
    WHERE whatsapp = '48991919191'
  )
);

-- Verificar se existe na tabela premium_subscriptions (se existir)
SELECT 
  id,
  user_id,
  establishment_id,
  display_name,
  whatsapp,
  created_at
FROM premium_subscriptions 
WHERE whatsapp = '48991919191';

-- Verificar se existe na tabela premium_subscribers (se existir)
SELECT 
  id,
  display_name,
  whatsapp,
  end_date,
  is_active,
  created_at,
  establishment_id
FROM premium_subscribers 
WHERE whatsapp = '48991919191';
