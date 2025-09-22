-- CORRIGIR COMPLETAMENTE O SISTEMA DE PROFESSIONAL_ID
-- Execute este SQL para corrigir tudo de uma vez

-- 1. Adicionar coluna se não existir
ALTER TABLE appointment_products 
ADD COLUMN IF NOT EXISTS professional_id TEXT;

-- 2. Atualizar todos os registros existentes
-- Pegar o professional do appointment e colocar no appointment_products
UPDATE appointment_products 
SET professional_id = a.professional
FROM appointments a
WHERE appointment_products.appointment_id = a.id
AND appointment_products.professional_id IS NULL;

-- 3. Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_appointment_products_professional_id 
ON appointment_products(professional_id);

-- 4. Adicionar comentário
COMMENT ON COLUMN appointment_products.professional_id IS 'Nome do profissional que vendeu o produto';

-- 5. Verificar se funcionou
SELECT 
  '✅ VERIFICAÇÃO FINAL' as status,
  COUNT(*) as total_registros,
  COUNT(professional_id) as com_professional_id,
  COUNT(*) - COUNT(professional_id) as sem_professional_id
FROM appointment_products;

-- 6. Mostrar alguns exemplos
SELECT 
  ap.id,
  ap.product_id,
  ap.professional_id,
  a.professional as appointment_professional,
  ep.name as product_name,
  a.appointment_date
FROM appointment_products ap
LEFT JOIN appointments a ON ap.appointment_id = a.id
LEFT JOIN establishment_products ep ON ap.product_id = ep.id
ORDER BY ap.created_at DESC
LIMIT 5;
