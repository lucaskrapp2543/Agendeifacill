-- REMOVER registro de assinante com WhatsApp 48991919191
-- Este SQL vai deletar o registro que está causando a detecção incorreta

-- Primeiro, vamos VER o que existe antes de deletar
SELECT 
  id,
  user_id,
  establishment_id,
  display_name,
  whatsapp,
  created_at
FROM premium_subscriptions 
WHERE whatsapp = '48991919191';

-- Se quiser REMOVER completamente (descomente a linha abaixo):
DELETE FROM premium_subscriptions WHERE whatsapp = '48991919191';

-- Verificar se foi removido
SELECT 
  id,
  user_id,
  establishment_id,
  display_name,
  whatsapp,
  created_at
FROM premium_subscriptions 
WHERE whatsapp = '48991919191';
