-- CORRIGIR NOMES DOS PROFISSIONAIS (VERSÃO SIMPLES)
-- Execute este SQL para corrigir os nomes de forma mais direta

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

-- 2. Ver os profissionais no JSON (versão simples)
SELECT 
  e.id as establishment_id,
  e.name as establishment_name,
  e.professionals
FROM establishments e
WHERE e.professionals IS NOT NULL;

-- 3. Corrigir appointments manualmente baseado nos dados que vimos
-- Vamos fazer UPDATE direto baseado nos IDs que aparecem

-- Para "Profissional 1" (ID "1")
UPDATE appointments 
SET professional = 'Profissional 1'
WHERE professional = '1';

-- Se houver outros IDs, adicione aqui:
-- UPDATE appointments 
-- SET professional = 'Nome do Funcionário'
-- WHERE professional = 'ID_do_funcionario';

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
