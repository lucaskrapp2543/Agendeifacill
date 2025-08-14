-- Limpar IDs manuais da tabela client_subscriptions
-- Primeiro, vamos verificar se existem IDs manuais
SELECT 
  id,
  client_id,
  establishment_id,
  payment_status,
  created_at
FROM client_subscriptions 
WHERE client_id LIKE 'manual_%';

-- Deletar registros com IDs manuais (se existirem)
DELETE FROM client_subscriptions 
WHERE client_id LIKE 'manual_%';

-- Verificar se ainda existem IDs manuais
SELECT 
  id,
  client_id,
  establishment_id,
  payment_status,
  created_at
FROM client_subscriptions 
WHERE client_id LIKE 'manual_%'; 