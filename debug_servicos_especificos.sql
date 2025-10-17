-- DEBUG: Verificar serviços específicos dos profissionais
-- Execute este script para verificar se os serviços específicos estão sendo salvos

-- 1. Verificar estrutura da tabela establishments
SELECT 
    id,
    name,
    jsonb_pretty(professionals) as profissionais_json
FROM establishments 
WHERE id = 'fbba6634-e8f8-4e15-be17-e5a67ee7dea2' -- Substitua pelo ID do seu estabelecimento
LIMIT 1;

-- 2. Verificar se há profissionais com serviços específicos
SELECT 
    id,
    name,
    jsonb_array_length(professionals) as total_profissionais
FROM establishments 
WHERE id = 'fbba6634-e8f8-4e15-be17-e5a67ee7dea2' -- Substitua pelo ID do seu estabelecimento
LIMIT 1;

-- 3. Buscar profissionais específicos com serviços específicos
SELECT 
    professional->>'id' as profissional_id,
    professional->>'name' as nome_profissional,
    professional->'specific_services' as servicos_especificos
FROM establishments,
     jsonb_array_elements(professionals) as professional
WHERE id = 'fbba6634-e8f8-4e15-be17-e5a67ee7dea2' -- Substitua pelo ID do seu estabelecimento
  AND professional->'specific_services' IS NOT NULL
  AND jsonb_array_length(professional->'specific_services') > 0;

-- 4. Verificar todos os profissionais do estabelecimento
SELECT 
    professional->>'id' as profissional_id,
    professional->>'name' as nome_profissional,
    professional->>'whatsapp' as whatsapp,
    professional->'specific_services' as servicos_especificos
FROM establishments,
     jsonb_array_elements(professionals) as professional
WHERE id = 'fbba6634-e8f8-4e15-be17-e5a67ee7dea2' -- Substitua pelo ID do seu estabelecimento
ORDER BY professional->>'name';
