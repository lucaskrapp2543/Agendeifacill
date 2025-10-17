-- ADICIONAR WHATSAPP SIMPLES PARA TESTE
-- Execute este SQL para adicionar WhatsApp de teste

-- 1. VER qual estabelecimento tem profissionais
SELECT 
    id,
    name,
    professionals
FROM establishments 
WHERE professionals IS NOT NULL 
    AND professionals::text != '[]'
LIMIT 1;

-- 2. ADICIONAR WhatsApp para todos os profissionais (versão simples)
-- Substitua 'fbba6634-e8f8-4e15-be17-e5a67ee7dea2' pelo ID do seu estabelecimento
UPDATE establishments 
SET professionals = (
    SELECT jsonb_agg(
        professional || '{"whatsapp": "(47) 99999-9999"}'::jsonb
    )
    FROM jsonb_array_elements(professionals) AS professional
)
WHERE id = 'fbba6634-e8f8-4e15-be17-e5a67ee7dea2';

-- 3. VERIFICAR resultado
SELECT 
    professional_data->>'name' as nome,
    professional_data->>'whatsapp' as whatsapp
FROM (
    SELECT jsonb_array_elements(professionals) as professional_data
    FROM establishments 
    WHERE id = 'fbba6634-e8f8-4e15-be17-e5a67ee7dea2'
) AS pros
ORDER BY nome;
