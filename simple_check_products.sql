-- VERIFICAÇÃO SIMPLES DE PRODUTOS E VENDAS
-- Execute este SQL para ver se há dados

-- 1. Ver produtos do estabelecimento
SELECT 
  id,
  name,
  stock_quantity,
  sold_quantity,
  sale_price
FROM establishment_products
ORDER BY created_at DESC;

-- 2. Ver vendas de produtos (appointment_products)
SELECT 
  ap.id,
  ap.product_id,
  ap.quantity,
  ap.unit_price,
  ap.professional_id,
  ep.name as product_name
FROM appointment_products ap
LEFT JOIN establishment_products ep ON ap.product_id = ep.id
ORDER BY ap.created_at DESC;

-- 3. Ver agendamentos com produtos
SELECT 
  a.id,
  a.professional,
  a.appointment_date,
  a.status,
  a.establishment_id,
  ep.name as product_name
FROM appointments a
JOIN appointment_products ap ON a.id = ap.appointment_id
LEFT JOIN establishment_products ep ON ap.product_id = ep.id
ORDER BY a.appointment_date DESC;
