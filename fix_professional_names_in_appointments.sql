-- CORRIGIR NOMES DOS PROFISSIONAIS NA TABELA APPOINTMENTS
-- Execute este SQL para corrigir os nomes

-- 1. Ver o problema atual
SELECT 
  'PROBLEMA ATUAL' as status,
  id,
  professional,
  appointment_date,
  status
FROM appointments 
WHERE professional IS NOT NULL
ORDER BY appointment_date DESC;

-- 2. Ver os profissionais configurados no estabelecimento
SELECT 
  id,
  name,
  professionals
FROM establishments
WHERE professionals IS NOT NULL;

-- 3. Corrigir appointments que têm professional com ID
-- Vamos assumir que o professional deveria ser o nome do primeiro profissional
-- ou você pode ajustar conforme necessário

-- Primeiro, vamos ver quais são os nomes corretos dos profissionais
SELECT 
  e.id as establishment_id,
  e.name as establishment_name,
  jsonb_array_elements(e.professionals) as professional_data
FROM establishments e
WHERE e.professionals IS NOT NULL;

-- 4. Atualizar appointments com nomes corretos
-- ATENÇÃO: Ajuste os nomes conforme seus profissionais reais
-- Substitua pelos nomes corretos dos seus funcionários

-- Exemplo: Se você tem "João Silva" e "Maria Santos" como profissionais
UPDATE appointments 
SET professional = 'João Silva'
WHERE professional = '36fa9135-5f74-4694-b142-b50c8d2e52e5';

-- Se houver outros IDs, faça o mesmo:
-- UPDATE appointments 
-- SET professional = 'Maria Santos'
-- WHERE professional = 'outro-id-aqui';

-- 5. Verificar se foi corrigido
SELECT 
  'APÓS CORREÇÃO' as status,
  id,
  professional,
  appointment_date,
  status
FROM appointments 
WHERE professional IS NOT NULL
ORDER BY appointment_date DESC;

-- 6. Verificar quantos foram corrigidos
SELECT 
  professional,
  COUNT(*) as quantidade
FROM appointments 
WHERE professional IS NOT NULL
GROUP BY professional
ORDER BY quantidade DESC;
