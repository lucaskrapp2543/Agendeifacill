-- LIMPEZA: Remover registros órfãos de assinantes
-- Este SQL remove registros que não têm usuário correspondente

-- 1. Verificar registros órfãos na tabela client_subscriptions
SELECT 
  'client_subscriptions' as tabela,
  cs.id,
  cs.client_id,
  cs.client_whatsapp,
  cs.subscriber_whatsapp,
  cs.created_at,
  'Órfão - client_id não existe em auth.users' as motivo
FROM client_subscriptions cs
LEFT JOIN auth.users au ON cs.client_id = au.id
WHERE au.id IS NULL
AND cs.client_id NOT LIKE 'manual_%';

-- 2. Verificar registros órfãos na tabela premium_subscriptions
SELECT 
  'premium_subscriptions' as tabela,
  ps.id,
  ps.user_id,
  ps.whatsapp,
  ps.created_at,
  'Órfão - user_id não existe em auth.users' as motivo
FROM premium_subscriptions ps
LEFT JOIN auth.users au ON ps.user_id = au.id
WHERE au.id IS NULL;

-- 3. Verificar registros duplicados (mesmo WhatsApp em ambas as tabelas)
SELECT 
  'duplicados' as tipo,
  cs.client_whatsapp as whatsapp,
  cs.id as client_subscription_id,
  ps.id as premium_subscription_id,
  'Mesmo WhatsApp em ambas as tabelas' as motivo
FROM client_subscriptions cs
INNER JOIN premium_subscriptions ps ON cs.client_whatsapp = ps.whatsapp
WHERE cs.establishment_id = ps.establishment_id;

-- 4. Se quiser REMOVER registros órfãos (descomente as linhas abaixo):
-- DELETE FROM client_subscriptions 
-- WHERE client_id NOT LIKE 'manual_%' 
-- AND client_id NOT IN (SELECT id FROM auth.users);

-- DELETE FROM premium_subscriptions 
-- WHERE user_id NOT IN (SELECT id FROM auth.users);
