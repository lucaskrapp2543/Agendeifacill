-- Verificar se existe assinante com esse WhatsApp
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

-- Verificar também na tabela client_subscriptions (sistema antigo)
SELECT 
  id,
  client_whatsapp,
  end_date,
  status,
  created_at
FROM client_subscriptions 
WHERE client_whatsapp = '48991919191';

-- Se quiser REMOVER o assinante (descomente a linha abaixo):
-- DELETE FROM premium_subscribers WHERE whatsapp = '48991919191';

-- Se quiser DESATIVAR ao invés de remover (descomente a linha abaixo):
-- UPDATE premium_subscribers SET is_active = false WHERE whatsapp = '48991919191';
