-- VERIFICAR se os assinantes do novo sistema estão intactos
-- Este SQL confirma que não afetamos os assinantes válidos

-- 1. Verificar assinantes do novo sistema (premium_subscriptions)
SELECT 
  'premium_subscriptions' as sistema,
  COUNT(*) as total_assinantes,
  COUNT(CASE WHEN is_active = true THEN 1 END) as ativos,
  COUNT(CASE WHEN is_active = false THEN 1 END) as inativos
FROM premium_subscriptions;

-- 2. Verificar assinantes do sistema antigo (client_subscriptions) - apenas válidos
SELECT 
  'client_subscriptions' as sistema,
  COUNT(*) as total_assinantes,
  COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) as pagos,
  COUNT(CASE WHEN payment_status = 'unpaid' THEN 1 END) as nao_pagos
FROM client_subscriptions 
WHERE client_id NOT LIKE 'manual_%' -- Excluir registros órfãos
AND client_id IN (SELECT id FROM auth.users); -- Apenas com usuário válido

-- 3. Verificar se ainda existem registros órfãos (devem ser 0)
SELECT 
  'registros_orfaos' as tipo,
  COUNT(*) as total_orfaos
FROM client_subscriptions 
WHERE client_id LIKE 'manual_%' 
OR client_id NOT IN (SELECT id FROM auth.users);
