-- Função para adicionar photo_url aos profissionais existentes
CREATE OR REPLACE FUNCTION add_photo_url_to_professionals()
RETURNS void AS $$
DECLARE
    establishment_record RECORD;
    updated_professionals jsonb[];
    professional jsonb;
BEGIN
    -- Para cada estabelecimento que tem profissionais
    FOR establishment_record IN 
        SELECT id, professionals 
        FROM establishments 
        WHERE professionals IS NOT NULL 
        AND array_length(professionals, 1) > 0
    LOOP
        updated_professionals := ARRAY[]::jsonb[];
        
        -- Para cada profissional, adicionar photo_url se não existir
        FOR i IN 1..array_length(establishment_record.professionals, 1)
        LOOP
            professional := establishment_record.professionals[i];
            
            -- Adicionar photo_url se não existir
            IF NOT (professional ? 'photo_url') THEN
                professional := professional || '{"photo_url": null}'::jsonb;
            END IF;
            
            updated_professionals := array_append(updated_professionals, professional);
        END LOOP;
        
        -- Atualizar o estabelecimento com os profissionais modificados
        UPDATE establishments 
        SET professionals = updated_professionals
        WHERE id = establishment_record.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Executar a função
SELECT add_photo_url_to_professionals();

-- Limpar a função
DROP FUNCTION add_photo_url_to_professionals();

-- Verificar se a migração foi aplicada
SELECT 
    e.id,
    e.name,
    p->>'name' as professional_name,
    p->>'photo_url' as photo_url
FROM establishments e,
     unnest(e.professionals) as p
WHERE e.professionals IS NOT NULL 
AND array_length(e.professionals, 1) > 0
LIMIT 5;
