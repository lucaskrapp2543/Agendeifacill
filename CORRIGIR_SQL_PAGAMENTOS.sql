-- ===============================================
-- CORREÇÃO: SISTEMA DE CONTROLE DE PAGAMENTOS
-- ===============================================
-- O professional_id é STRING, não UUID!

-- 1. ALTERAR TIPO DA COLUNA professional_id
ALTER TABLE professional_payments 
ALTER COLUMN professional_id TYPE TEXT;

-- 2. VERIFICAR SE FOI ALTERADO CORRETAMENTE
SELECT 
  '✅ COLUNA CORRIGIDA!' as status,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'professional_payments' 
  AND column_name = 'professional_id';

-- 3. TESTAR INSERÇÃO COM ID STRING
INSERT INTO professional_payments (
  establishment_id,
  professional_id,
  professional_name,
  amount
) VALUES (
  (SELECT id FROM establishments LIMIT 1),
  '1',
  'Teste',
  100.00
);

-- 4. VERIFICAR SE INSERIU CORRETAMENTE
SELECT * FROM professional_payments WHERE professional_id = '1';

-- 5. LIMPAR DADOS DE TESTE
DELETE FROM professional_payments WHERE professional_id = '1';

-- ===============================================
-- FIM DA CORREÇÃO
-- ===============================================
