-- VERIFICAR WHATSAPP DOS PROFISSIONAIS
-- Execute este SQL para ver se os profissionais têm WhatsApp cadastrado

-- 1. Ver todos os estabelecimentos e seus profissionais
SELECT 
    id,
    name,
    professionals
FROM establishments 
WHERE professionals IS NOT NULL 
    AND professionals::text != '[]'
ORDER BY name;

-- 2. Ver detalhes dos profissionais (incluindo WhatsApp se existir)
SELECT 
    id as establishment_id,
    name as establishment_name,
    jsonb_array_elements(professionals) as professional_data
FROM establishments 
WHERE professionals IS NOT NULL 
    AND professionals::text != '[]'
ORDER BY establishment_name;

-- 3. Verificar especificamente quais profissionais têm WhatsApp
SELECT 
    id as establishment_id,
    name as establishment_name,
    professional_data->>'name' as professional_name,
    professional_data->>'whatsapp' as whatsapp,
    professional_data->>'percentage' as percentage,
    professional_data->>'photo_url' as photo_url
FROM (
    SELECT 
        id,
        name,
        jsonb_array_elements(professionals) as professional_data
    FROM establishments 
    WHERE professionals IS NOT NULL 
        AND professionals::text != '[]'
) AS professionals_expanded
ORDER BY establishment_name, professional_name;

-- 4. Contar quantos profissionais têm WhatsApp
SELECT 
    '=== RESUMO ===' as status,
    COUNT(*) as total_profissionais,
    COUNT(CASE WHEN professional_data->>'whatsapp' IS NOT NULL AND professional_data->>'whatsapp' != '' THEN 1 END) as com_whatsapp,
    COUNT(CASE WHEN professional_data->>'whatsapp' IS NULL OR professional_data->>'whatsapp' = '' THEN 1 END) as sem_whatsapp
FROM (
    SELECT jsonb_array_elements(professionals) as professional_data
    FROM establishments 
    WHERE professionals IS NOT NULL 
        AND professionals::text != '[]'
) AS all_professionals;
