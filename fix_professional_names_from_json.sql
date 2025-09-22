-- CORRIGIR NOMES DOS PROFISSIONAIS USANDO OS DADOS DO JSON
-- Execute este SQL para corrigir os nomes baseado no JSON de professionals

-- 1. Ver o problema atual nos appointments
SELECT 
  'PROBLEMA ATUAL' as status,
  a.id,
  a.professional,
  a.appointment_date,
  a.status
FROM appointments a
WHERE a.professional IS NOT NULL
ORDER BY a.appointment_date DESC;

-- 2. Ver os profissionais no JSON
SELECT 
  e.id as establishment_id,
  e.name as establishment_name,
  jsonb_array_elements(e.professionals) as professional_data
FROM establishments e
WHERE e.professionals IS NOT NULL;

-- 3. Corrigir appointments baseado no JSON de professionals
-- Vamos pegar o nome correto do JSON e atualizar o campo professional

-- Para estabelecimento com ID específico (substitua pelo seu ID)
UPDATE appointments 
SET professional = (
  SELECT professional_data->>'name'
  FROM establishments e,
  jsonb_array_elements(e.professionals) as professional_data
  WHERE e.id = appointments.establishment_id
  AND professional_data->>'id' = appointments.professional
)
WHERE professional IN (
  SELECT professional_data->>'id'
  FROM establishments e,
  jsonb_array_elements(e.professionals) as professional_data
  WHERE e.id = appointments.establishment_id
);

-- 4. Verificar se foi corrigido
SELECT 
  'APÓS CORREÇÃO' as status,
  a.id,
  a.professional,
  a.appointment_date,
  a.status
FROM appointments a
WHERE a.professional IS NOT NULL
ORDER BY a.appointment_date DESC;

-- 5. Verificar quantos foram corrigidos
SELECT 
  professional,
  COUNT(*) as quantidade
FROM appointments 
WHERE professional IS NOT NULL
GROUP BY professional
ORDER BY quantidade DESC;

-- 6. Ver appointments com produtos vendidos após correção
SELECT 
  a.id,
  a.professional,
  a.appointment_date,
  a.status,
  ep.name as product_name
FROM appointments a
JOIN appointment_products ap ON a.id = ap.appointment_id
LEFT JOIN establishment_products ep ON ap.product_id = ep.id
ORDER BY a.appointment_date DESC;
