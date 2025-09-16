-- Verificar estrutura da tabela premium_subscriptions
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'premium_subscriptions' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Verificar se existe algum registro com esse WhatsApp
SELECT 
  id,
  user_id,
  establishment_id,
  display_name,
  whatsapp,
  created_at
FROM premium_subscriptions 
WHERE whatsapp = '48991919191';
