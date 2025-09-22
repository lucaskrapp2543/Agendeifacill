-- DEBUG: VERIFICAR VENDAS DE PRODUTOS
-- Execute este SQL para ver o que está acontecendo

-- 1. Verificar se existem appointment_products
SELECT 
  'TOTAL DE appointment_products' as tabela,
  COUNT(*) as quantidade
FROM appointment_products;

-- 2. Verificar se existem establishment_products
SELECT 
  'TOTAL DE establishment_products' as tabela,
  COUNT(*) as quantidade
FROM establishment_products;

-- 3. Ver todos os appointment_products com detalhes
SELECT 
  ap.id,
  ap.product_id,
  ap.quantity,
  ap.unit_price,
  ap.professional_id,
  a.professional as appointment_professional,
  a.appointment_date,
  a.status,
  ep.name as product_name,
  e.name as establishment_name
FROM appointment_products ap
LEFT JOIN appointments a ON ap.appointment_id = a.id
LEFT JOIN establishment_products ep ON ap.product_id = ep.id
LEFT JOIN establishments e ON a.establishment_id = e.id
ORDER BY ap.created_at DESC;

-- 4. Ver apenas produtos com status 'completed'
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
WHERE a.status = 'completed'
ORDER BY ap.created_at DESC;

-- 5. Verificar se a coluna professional_id está preenchida
SELECT 
  COUNT(*) as total,
  COUNT(professional_id) as com_professional_id,
  COUNT(*) - COUNT(professional_id) as sem_professional_id
FROM appointment_products;

-- 6. Ver alguns exemplos de professional_id
SELECT DISTINCT 
  professional_id,
  COUNT(*) as quantidade
FROM appointment_products 
WHERE professional_id IS NOT NULL
GROUP BY professional_id;
