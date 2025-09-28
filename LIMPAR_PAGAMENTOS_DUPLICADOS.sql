-- ===============================================
-- LIMPAR PAGAMENTOS DUPLICADOS ACIDENTAIS
-- ===============================================
-- Execute este SQL para limpar pagamentos duplicados

-- 1. VER QUANTOS PAGAMENTOS DUPLICADOS EXISTEM
SELECT 
  professional_id,
  professional_name,
  amount,
  COUNT(*) as quantidade,
  STRING_AGG(id::text, ', ') as ids_duplicados
FROM professional_payments
GROUP BY professional_id, professional_name, amount, DATE(payment_date)
HAVING COUNT(*) > 1
ORDER BY professional_name, amount;

-- 2. DELETAR PAGAMENTOS DUPLICADOS (MANTER APENAS O MAIS ANTIGO)
WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY professional_id, professional_name, amount, DATE(payment_date)
      ORDER BY created_at ASC
    ) as rn
  FROM professional_payments
)
DELETE FROM professional_payments 
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- 3. VERIFICAR SE FOI LIMPO
SELECT 
  '✅ LIMPEZA CONCLUÍDA!' as status,
  professional_id,
  professional_name,
  amount,
  COUNT(*) as quantidade_restante
FROM professional_payments
GROUP BY professional_id, professional_name, amount, DATE(payment_date)
ORDER BY professional_name, amount;

-- ===============================================
-- FIM DA LIMPEZA
-- ===============================================
