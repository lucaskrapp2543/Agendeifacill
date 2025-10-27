-- Teste da função RPC para verificar se está funcionando
-- Substitua os valores pelos dados reais do seu assinante

-- Teste 1: Verificar se a função existe
SELECT 
  routine_name, 
  routine_type, 
  data_type 
FROM information_schema.routines 
WHERE routine_name = 'check_subscriber_by_whatsapp';

-- Teste 2: Testar a função com dados reais
-- Substitua 'SEU_WHATSAPP_AQUI' pelo WhatsApp do assinante
-- Substitua 'SEU_ESTABLISHMENT_ID_AQUI' pelo ID do estabelecimento
SELECT * FROM check_subscriber_by_whatsapp('SEU_WHATSAPP_AQUI', 'SEU_ESTABLISHMENT_ID_AQUI');

-- Teste 3: Verificar dados na tabela client_subscriptions
SELECT 
  cs.id,
  cs.client_name_override,
  cs.subscriber_name,
  cs.client_whatsapp,
  cs.subscriber_whatsapp,
  cs.weekdays,
  cs.subscription_id,
  cs.establishment_id,
  s.name as subscription_name
FROM client_subscriptions cs
LEFT JOIN subscriptions s ON cs.subscription_id = s.id
WHERE cs.establishment_id = 'SEU_ESTABLISHMENT_ID_AQUI'
ORDER BY cs.created_at DESC
LIMIT 5;
