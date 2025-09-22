-- CORRIGIR NOMES DOS PROFISSIONAIS (VERSÃO CORRIGIDA)
-- Execute este SQL para corrigir o problema

-- 1. Ver o problema atual
SELECT 
  'PROBLEMA ATUAL' as status,
  ap.id,
  ap.product_id,
  ap.professional_id,
  a.professional as appointment_professional,
  ep.name as product_name,
  a.appointment_date
FROM appointment_products ap
LEFT JOIN appointments a ON ap.appointment_id = a.id
LEFT JOIN establishment_products ep ON ap.product_id = ep.id
ORDER BY ap.created_at DESC;

-- 2. Corrigir appointment_products que estão com professional_id errado
-- Converter product_id para TEXT para comparar
UPDATE appointment_products 
SET professional_id = a.professional
FROM appointments a
WHERE appointment_products.appointment_id = a.id
AND appointment_products.professional_id = appointment_products.product_id::text;

-- 3. Corrigir appointment_products que estão NULL
UPDATE appointment_products 
SET professional_id = a.professional
FROM appointments a
WHERE appointment_products.appointment_id = a.id
AND appointment_products.professional_id IS NULL;

-- 4. Verificar se foi corrigido
SELECT 
  'APÓS CORREÇÃO' as status,
  ap.id,
  ap.product_id,
  ap.professional_id,
  a.professional as appointment_professional,
  ep.name as product_name,
  a.appointment_date
FROM appointment_products ap
LEFT JOIN appointments a ON ap.appointment_id = a.id
LEFT JOIN establishment_products ep ON ap.product_id = ep.id
ORDER BY ap.created_at DESC;

-- 5. Contar quantos foram corrigidos
SELECT 
  COUNT(*) as total_sales,
  COUNT(CASE WHEN ap.professional_id IS NOT NULL AND ap.professional_id != ap.product_id::text THEN 1 END) as com_nome_correto,
  COUNT(CASE WHEN ap.professional_id = ap.product_id::text THEN 1 END) as com_id_errado,
  COUNT(CASE WHEN ap.professional_id IS NULL THEN 1 END) as sem_professional_id
FROM appointment_products ap;
