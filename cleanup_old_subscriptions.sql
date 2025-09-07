-- Script para limpar assinaturas antigas/inativas que podem estar causando detecções incorretas

-- 1. Marcar assinaturas expiradas como não pagas (usando valor válido do enum)
UPDATE client_subscriptions 
SET payment_status = 'unpaid'
WHERE end_date < CURRENT_DATE 
  AND payment_status = 'paid';

-- 2. Marcar assinaturas que ainda não começaram como não pagas
UPDATE client_subscriptions 
SET payment_status = 'unpaid'
WHERE start_date > CURRENT_DATE 
  AND payment_status = 'paid';

-- 3. Verificar quantas assinaturas foram afetadas
SELECT 
  payment_status,
  COUNT(*) as quantidade
FROM client_subscriptions 
GROUP BY payment_status;

-- 4. Mostrar assinaturas ativas (que devem ser detectadas)
SELECT 
  cs.id,
  cs.subscriber_name,
  cs.subscriber_whatsapp,
  cs.payment_status,
  cs.start_date,
  cs.end_date,
  s.name as subscription_name
FROM client_subscriptions cs
LEFT JOIN subscriptions s ON cs.subscription_id = s.id
WHERE cs.payment_status = 'paid'
  AND cs.end_date >= CURRENT_DATE
  AND cs.start_date <= CURRENT_DATE
ORDER BY cs.created_at DESC;

-- 5. Mostrar assinaturas que NÃO devem ser detectadas (para debug)
SELECT 
  cs.id,
  cs.subscriber_name,
  cs.subscriber_whatsapp,
  cs.payment_status,
  cs.start_date,
  cs.end_date,
  s.name as subscription_name,
  CASE 
    WHEN cs.end_date < CURRENT_DATE THEN 'EXPIRADA'
    WHEN cs.start_date > CURRENT_DATE THEN 'AINDA NÃO COMEÇOU'
    WHEN cs.payment_status != 'paid' THEN 'NÃO PAGA'
    ELSE 'OUTRO MOTIVO'
  END as motivo_nao_detectar
FROM client_subscriptions cs
LEFT JOIN subscriptions s ON cs.subscription_id = s.id
WHERE NOT (
  cs.payment_status = 'paid'
  AND cs.end_date >= CURRENT_DATE
  AND cs.start_date <= CURRENT_DATE
)
ORDER BY cs.created_at DESC;
