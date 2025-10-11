-- Verificar clubes de assinatura do seu estabelecimento

-- 1. Ver todas as assinaturas do seu estabelecimento
SELECT 
  id,
  name,
  service_name,
  service_duration,
  price,
  is_active,
  establishment_id
FROM subscriptions
WHERE establishment_id IN (
  SELECT id FROM establishments WHERE owner_id = auth.uid()
)
ORDER BY created_at DESC;

-- 2. Contar quantas assinaturas ativas você tem
SELECT 
  COUNT(*) as total_assinaturas,
  COUNT(*) FILTER (WHERE is_active = true) as assinaturas_ativas
FROM subscriptions
WHERE establishment_id IN (
  SELECT id FROM establishments WHERE owner_id = auth.uid()
);

-- 3. Ver establishment_id para debug
SELECT 
  id as establishment_id,
  name as establishment_name
FROM establishments
WHERE owner_id = auth.uid();
