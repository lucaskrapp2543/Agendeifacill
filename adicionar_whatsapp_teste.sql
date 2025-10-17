-- ADICIONAR WHATSAPP DE TESTE PARA PROFISSIONAIS
-- Execute este SQL para adicionar WhatsApp de teste para alguns profissionais

-- 1. VER os profissionais atuais
SELECT 
    id,
    name,
    professionals
FROM establishments 
WHERE professionals IS NOT NULL 
    AND professionals::text != '[]'
LIMIT 1;

-- 2. ADICIONAR WhatsApp de teste para os primeiros 3 profissionais
-- (Substitua 'SEU_ESTABELECIMENTO_ID' pelo ID real do seu estabelecimento)
UPDATE establishments 
SET professionals = (
    SELECT jsonb_agg(
        CASE 
            WHEN professional->>'name' = 'Antonio' THEN professional || '{"whatsapp": "(47) 99999-0001"}'::jsonb
            WHEN professional->>'name' = 'Joseph' THEN professional || '{"whatsapp": "(47) 99999-0002"}'::jsonb
            WHEN professional->>'name' = 'Raoni' THEN professional || '{"whatsapp": "(47) 99999-0003"}'::jsonb
            WHEN professional->>'name' = 'pedro' THEN professional || '{"whatsapp": "(47) 99999-0004"}'::jsonb
            ELSE professional
        END
    )
    FROM jsonb_array_elements(professionals) AS professional
)
WHERE professionals IS NOT NULL 
    AND professionals::text != '[]';

-- 3. VERIFICAR se foi adicionado
SELECT 
    id,
    name,
    professional_data->>'name' as professional_name,
    professional_data->>'whatsapp' as whatsapp
FROM (
    SELECT 
        id,
        name,
        jsonb_array_elements(professionals) as professional_data
    FROM establishments 
    WHERE professionals IS NOT NULL 
        AND professionals::text != '[]'
) AS professionals_expanded
WHERE professional_data->>'whatsapp' IS NOT NULL
ORDER BY professional_name;
