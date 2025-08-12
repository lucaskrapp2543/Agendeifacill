-- Adiciona campo percentual aos profissionais existentes
-- Atualiza profissionais existentes para ter percentual padrão de 100%

-- Função para atualizar profissionais existentes com percentual padrão
CREATE OR REPLACE FUNCTION update_existing_professionals_with_percentage()
RETURNS void AS $$
DECLARE
    establishment_record RECORD;
    updated_professionals jsonb[];
    professional jsonb;
    i integer;
BEGIN
    -- Para cada estabelecimento
    FOR establishment_record IN SELECT id, professionals FROM establishments WHERE professionals IS NOT NULL AND array_length(professionals, 1) > 0
    LOOP
        updated_professionals := ARRAY[]::jsonb[];
        
        -- Para cada profissional no estabelecimento
        FOR i IN 1..array_length(establishment_record.professionals, 1)
        LOOP
            professional := establishment_record.professionals[i];
            
            -- Adiciona percentual padrão de 100% se não existir
            IF NOT (professional ? 'percentage') THEN
                professional := professional || '{"percentage": 100}'::jsonb;
            END IF;
            
            updated_professionals := array_append(updated_professionals, professional);
        END LOOP;
        
        -- Atualiza o estabelecimento com os profissionais atualizados
        UPDATE establishments 
        SET professionals = updated_professionals 
        WHERE id = establishment_record.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Executa a função para atualizar profissionais existentes
SELECT update_existing_professionals_with_percentage();

-- Remove a função temporária
DROP FUNCTION update_existing_professionals_with_percentage();

-- Comentário explicativo
COMMENT ON COLUMN establishments.professionals IS 'Array de profissionais com campos: id, name, specialties, percentage (percentual do profissional - padrão 100%)'; 