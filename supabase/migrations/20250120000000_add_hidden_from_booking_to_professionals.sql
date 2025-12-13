-- Adiciona campo hidden_from_booking aos profissionais existentes
-- Atualiza profissionais existentes para ter hidden_from_booking padrão de false

-- Função para atualizar profissionais existentes com campo hidden_from_booking
CREATE OR REPLACE FUNCTION update_existing_professionals_with_hidden_from_booking()
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
            
            -- Adiciona hidden_from_booking padrão de false se não existir
            IF NOT (professional ? 'hidden_from_booking') THEN
                professional := professional || '{"hidden_from_booking": false}'::jsonb;
            END IF;
            
            updated_professionals := array_append(updated_professionals, professional);
        END LOOP;
        
        -- Atualiza o estabelecimento com os profissionais atualizados
        UPDATE establishments 
        SET professionals = updated_professionals 
        WHERE id = establishment_record.id;
    END LOOP;
    
    RAISE NOTICE 'Campo hidden_from_booking adicionado a todos os profissionais existentes';
END;
$$ LANGUAGE plpgsql;

-- Executa a função para atualizar profissionais existentes
SELECT update_existing_professionals_with_hidden_from_booking();

-- Remove a função temporária
DROP FUNCTION update_existing_professionals_with_hidden_from_booking();

-- Comentário explicativo
COMMENT ON COLUMN establishments.professionals IS 'Array de profissionais com campos: id, name, specialties, percentage (percentual do profissional - padrão 100%), absences (array de datas de ausência), whatsapp (número de WhatsApp), hidden_from_booking (ocultar do booking público - padrão false)';

