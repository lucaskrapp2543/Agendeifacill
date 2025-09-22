-- VERIFICAR O CAMPO PROFESSIONAL NA TABELA APPOINTMENTS
-- Execute este SQL para ver o que está acontecendo

-- 1. Ver appointments com professional
SELECT 
  id,
  professional,
  appointment_date,
  status,
  establishment_id
FROM appointments 
WHERE professional IS NOT NULL
ORDER BY appointment_date DESC
LIMIT 10;

-- 2. Ver se o professional está com ID ou nome
SELECT 
  professional,
  COUNT(*) as quantidade
FROM appointments 
WHERE professional IS NOT NULL
GROUP BY professional
ORDER BY quantidade DESC;

-- 3. Ver appointments que têm produtos vendidos
SELECT 
  a.id,
  a.professional,
  a.appointment_date,
  a.status,
  ep.name as product_name
FROM appointments a
JOIN appointment_products ap ON a.id = ap.appointment_id
LEFT JOIN establishment_products ep ON ap.product_id = ep.id
ORDER BY a.appointment_date DESC
LIMIT 10;

-- 4. Verificar se há nomes de funcionários nos establishments
SELECT 
  id,
  name,
  professionals
FROM establishments
WHERE professionals IS NOT NULL;
