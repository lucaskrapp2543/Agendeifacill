-- VERIFICAR NOMES DOS PROFISSIONAIS
-- Execute este SQL para ver se os nomes estão corretos

-- 1. Ver appointment_products com professional_id
SELECT 
  ap.id,
  ap.product_id,
  ap.professional_id,
  ep.name as product_name
FROM appointment_products ap
LEFT JOIN establishment_products ep ON ap.product_id = ep.id
WHERE ap.professional_id IS NOT NULL;

-- 2. Ver appointments com professional
SELECT 
  a.id,
  a.professional,
  a.appointment_date,
  a.status,
  a.establishment_id
FROM appointments a
WHERE a.professional IS NOT NULL
ORDER BY a.appointment_date DESC;

-- 3. Ver appointment_products + appointments juntos
SELECT 
  ap.id as product_sale_id,
  ap.product_id,
  ap.professional_id as product_professional,
  a.professional as appointment_professional,
  a.appointment_date,
  a.status,
  ep.name as product_name
FROM appointment_products ap
LEFT JOIN appointments a ON ap.appointment_id = a.id
LEFT JOIN establishment_products ep ON ap.product_id = ep.id
ORDER BY ap.created_at DESC;

-- 4. Ver se há inconsistências
SELECT 
  COUNT(*) as total_sales,
  COUNT(CASE WHEN ap.professional_id IS NOT NULL THEN 1 END) as with_product_professional,
  COUNT(CASE WHEN a.professional IS NOT NULL THEN 1 END) as with_appointment_professional
FROM appointment_products ap
LEFT JOIN appointments a ON ap.appointment_id = a.id;
