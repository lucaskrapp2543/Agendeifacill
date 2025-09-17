-- Sistema de Ausências dos Profissionais
-- Adiciona suporte para marcar dias de ausência dos profissionais

-- Comentário explicativo sobre o campo de ausências
COMMENT ON COLUMN establishments.professionals IS 'Array de profissionais com campos: id, name, specialties, percentage (percentual do profissional - padrão 100%), absences (array de datas de ausência no formato YYYY-MM-DD)';

-- Função para atualizar profissionais existentes com campo de ausências
CREATE OR REPLACE FUNCTION add_absences_field_to_professionals()
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
            
            -- Adiciona campo de ausências vazio se não existir
            IF NOT (professional ? 'absences') THEN
                professional := professional || '{"absences": []}'::jsonb;
            END IF;
            
            updated_professionals := array_append(updated_professionals, professional);
        END LOOP;
        
        -- Atualiza o estabelecimento com os profissionais atualizados
        UPDATE establishments 
        SET professionals = updated_professionals 
        WHERE id = establishment_record.id;
    END LOOP;
    
    RAISE NOTICE 'Campo de ausências adicionado a todos os profissionais existentes';
END;
$$ LANGUAGE plpgsql;

-- Executa a função para adicionar campo de ausências aos profissionais existentes
SELECT add_absences_field_to_professionals();

-- Remove a função temporária
DROP FUNCTION add_absences_field_to_professionals();

-- Função para verificar se um profissional está ausente em uma data específica
CREATE OR REPLACE FUNCTION is_professional_absent(
    establishment_id_param uuid,
    professional_id_param text,
    date_param text
)
RETURNS boolean AS $$
DECLARE
    professional_record jsonb;
    absences_array jsonb;
BEGIN
    -- Busca o profissional no estabelecimento
    SELECT jsonb_array_elements(professionals) INTO professional_record
    FROM establishments 
    WHERE id = establishment_id_param;
    
    -- Verifica se encontrou o profissional
    IF professional_record IS NULL OR (professional_record->>'id') != professional_id_param THEN
        RETURN false;
    END IF;
    
    -- Obtém o array de ausências
    absences_array := professional_record->'absences';
    
    -- Verifica se o array de ausências existe e contém a data
    IF absences_array IS NULL OR jsonb_typeof(absences_array) != 'array' THEN
        RETURN false;
    END IF;
    
    -- Retorna true se a data estiver no array de ausências
    RETURN absences_array ? date_param;
END;
$$ LANGUAGE plpgsql;

-- Comentário explicativo sobre a função
COMMENT ON FUNCTION is_professional_absent(uuid, text, text) IS 'Verifica se um profissional específico está ausente em uma data específica. Retorna true se o profissional estiver ausente, false caso contrário.';

-- Exemplo de uso da função:
-- SELECT is_professional_absent('uuid-do-estabelecimento', 'id-do-profissional', '2025-01-20');

RAISE NOTICE 'Sistema de ausências dos profissionais implementado com sucesso!';
