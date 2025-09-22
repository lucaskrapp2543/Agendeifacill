-- TESTAR SE A COLUNA professional_id FOI CRIADA CORRETAMENTE
-- Execute este SQL para verificar se tudo está funcionando

-- 1. Verificar se a coluna existe
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'appointment_products' 
AND column_name = 'professional_id';

-- 2. Ver estrutura completa da tabela
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'appointment_products'
ORDER BY ordinal_position;

-- 3. Ver alguns registros de appointment_products (se existirem)
SELECT 
  ap.id,
  ap.product_id,
  ap.quantity,
  ap.unit_price,
  ap.professional_id,
  a.professional as appointment_professional,
  a.appointment_date,
  a.status,
  ep.name as product_name
FROM appointment_products ap
LEFT JOIN appointments a ON ap.appointment_id = a.id
LEFT JOIN establishment_products ep ON ap.product_id = ep.id
ORDER BY ap.created_at DESC
LIMIT 10;

-- 4. Se a coluna não existir, criar agora:
-- ALTER TABLE appointment_products 
-- ADD COLUMN IF NOT EXISTS professional_id TEXT;

-- 5. Atualizar registros existentes para ter professional_id baseado no appointment
UPDATE appointment_products 
SET professional_id = a.professional
FROM appointments a
WHERE appointment_products.appointment_id = a.id
AND appointment_products.professional_id IS NULL;

-- 6. Verificar se a atualização funcionou
SELECT 
  COUNT(*) as total_registros,
  COUNT(professional_id) as com_professional_id,
  COUNT(*) - COUNT(professional_id) as sem_professional_id
FROM appointment_products;
