-- Verificar os percentuais dos profissionais no banco de dados
SELECT 
  id,
  name,
  professionals
FROM establishments 
WHERE professionals IS NOT NULL 
  AND professionals::text != '[]'
ORDER BY name;

-- Verificar especificamente os percentuais
SELECT 
  id,
  name,
  jsonb_array_elements(professionals) as professional
FROM establishments 
WHERE professionals IS NOT NULL 
  AND professionals::text != '[]'
ORDER BY name;

-- Verificar se há profissionais sem percentual
SELECT 
  id,
  name,
  jsonb_array_elements(professionals) as professional
FROM establishments 
WHERE professionals IS NOT NULL 
  AND professionals::text != '[]'
  AND NOT (jsonb_array_elements(professionals) ? 'percentage')
ORDER BY name; 