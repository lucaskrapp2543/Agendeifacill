-- =====================================================
-- SISTEMA DE BLOQUEIO DE HORÁRIOS DOS PROFISSIONAIS - MIGRAÇÃO
-- =====================================================
-- Esta migração adiciona o campo 'blocked_hours' aos profissionais
-- para permitir o bloqueio de horários específicos

-- 1. Adicionar comentário explicativo sobre o campo de horários bloqueados
COMMENT ON COLUMN establishments.professionals IS 'Array de profissionais com campos: id, name, specialties, percentage (percentual do profissional - padrão 100%), absences (array de datas de ausência no formato YYYY-MM-DD), blocked_hours (objeto com datas como chaves e arrays de horários como valores, formato: {"2025-01-15": ["09:00", "10:00"]}), photo_url (URL da foto do profissional)';

-- 2. Função para atualizar profissionais existentes com campo de horários bloqueados
CREATE OR REPLACE FUNCTION add_blocked_hours_field_to_professionals()
RETURNS void AS $$
DECLARE
    establishment_record RECORD;
    updated_professionals jsonb[];
    professional jsonb;
    i integer;
    total_updated integer := 0;
BEGIN
    -- Para cada estabelecimento
    FOR establishment_record IN SELECT id, name, professionals FROM establishments WHERE professionals IS NOT NULL AND array_length(professionals, 1) > 0
    LOOP
        updated_professionals := ARRAY[]::jsonb[];
        
        -- Para cada profissional no estabelecimento
        FOR i IN 1..array_length(establishment_record.professionals, 1)
        LOOP
            professional := establishment_record.professionals[i];
            
            -- Adiciona campo de horários bloqueados vazio se não existir
            IF NOT (professional ? 'blocked_hours') THEN
                professional := professional || '{"blocked_hours": {}}'::jsonb;
                total_updated := total_updated + 1;
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

-- 3. Executa a função para adicionar campo de horários bloqueados aos profissionais existentes
SELECT add_blocked_hours_field_to_professionals();

-- 4. Remove a função temporária
DROP FUNCTION add_blocked_hours_field_to_professionals();

-- 5. Função para verificar se um horário está bloqueado para um profissional em uma data específica
CREATE OR REPLACE FUNCTION is_professional_hour_blocked(
    establishment_id_param uuid,
    professional_id_param text,
    date_param text,
    hour_param text
)
RETURNS boolean AS $$
DECLARE
    professional_record jsonb;
    blocked_hours_object jsonb;
BEGIN
    -- Busca o profissional no estabelecimento
    SELECT jsonb_array_elements(professionals) INTO professional_record
    FROM establishments 
    WHERE id = establishment_id_param;
    
    -- Verifica se encontrou o profissional
    IF professional_record IS NULL OR (professional_record->>'id') != professional_id_param THEN
        RETURN false;
    END IF;
    
    -- Obtém o objeto de horários bloqueados
    blocked_hours_object := professional_record->'blocked_hours';
    
    -- Verifica se o objeto de horários bloqueados existe
    IF blocked_hours_object IS NULL OR jsonb_typeof(blocked_hours_object) != 'object' THEN
        RETURN false;
    END IF;
    
    -- Verifica se a data existe no objeto
    IF NOT (blocked_hours_object ? date_param) THEN
        RETURN false;
    END IF;
    
    -- Obtém o array de horários bloqueados para a data
    DECLARE
        blocked_hours_for_date jsonb;
    BEGIN
        blocked_hours_for_date := blocked_hours_object->date_param;
        
        -- Verifica se é um array e se contém o horário
        IF jsonb_typeof(blocked_hours_for_date) = 'array' THEN
            RETURN blocked_hours_for_date ? hour_param;
        END IF;
        
        RETURN false;
    END;
END;
$$ LANGUAGE plpgsql;

-- 6. Comentário explicativo sobre a função
COMMENT ON FUNCTION is_professional_hour_blocked(uuid, text, text, text) IS 'Verifica se um horário específico está bloqueado para um profissional em uma data específica. Retorna true se o horário estiver bloqueado, false caso contrário.';

-- 7. Função para obter todos os horários bloqueados de um profissional para uma data específica
CREATE OR REPLACE FUNCTION get_professional_blocked_hours_for_date(
    establishment_id_param uuid,
    professional_id_param text,
    date_param text
)
RETURNS text[] AS $$
DECLARE
    professional_record jsonb;
    blocked_hours_object jsonb;
    blocked_hours_for_date jsonb;
    result text[];
BEGIN
    -- Busca o profissional no estabelecimento
    SELECT jsonb_array_elements(professionals) INTO professional_record
    FROM establishments 
    WHERE id = establishment_id_param;
    
    -- Verifica se encontrou o profissional
    IF professional_record IS NULL OR (professional_record->>'id') != professional_id_param THEN
        RETURN ARRAY[]::text[];
    END IF;
    
    -- Obtém o objeto de horários bloqueados
    blocked_hours_object := professional_record->'blocked_hours';
    
    -- Verifica se o objeto de horários bloqueados existe
    IF blocked_hours_object IS NULL OR jsonb_typeof(blocked_hours_object) != 'object' THEN
        RETURN ARRAY[]::text[];
    END IF;
    
    -- Verifica se a data existe no objeto
    IF NOT (blocked_hours_object ? date_param) THEN
        RETURN ARRAY[]::text[];
    END IF;
    
    -- Obtém o array de horários bloqueados para a data
    blocked_hours_for_date := blocked_hours_object->date_param;
    
    -- Verifica se é um array
    IF jsonb_typeof(blocked_hours_for_date) != 'array' THEN
        RETURN ARRAY[]::text[];
    END IF;
    
    -- Converte para array de strings
    SELECT ARRAY(
        SELECT jsonb_array_elements_text(blocked_hours_for_date)
    ) INTO result;
    
    RETURN COALESCE(result, ARRAY[]::text[]);
END;
$$ LANGUAGE plpgsql;

-- 8. Comentário explicativo sobre a função
COMMENT ON FUNCTION get_professional_blocked_hours_for_date(uuid, text, text) IS 'Retorna todos os horários bloqueados de um profissional para uma data específica como array de strings.';

-- 9. Função para obter todos os horários bloqueados de um profissional (todas as datas)
CREATE OR REPLACE FUNCTION get_professional_all_blocked_hours(
    establishment_id_param uuid,
    professional_id_param text
)
RETURNS jsonb AS $$
DECLARE
    professional_record jsonb;
    blocked_hours_object jsonb;
BEGIN
    -- Busca o profissional no estabelecimento
    SELECT jsonb_array_elements(professionals) INTO professional_record
    FROM establishments 
    WHERE id = establishment_id_param;
    
    -- Verifica se encontrou o profissional
    IF professional_record IS NULL OR (professional_record->>'id') != professional_id_param THEN
        RETURN '{}'::jsonb;
    END IF;
    
    -- Obtém o objeto de horários bloqueados
    blocked_hours_object := professional_record->'blocked_hours';
    
    -- Verifica se o objeto de horários bloqueados existe
    IF blocked_hours_object IS NULL OR jsonb_typeof(blocked_hours_object) != 'object' THEN
        RETURN '{}'::jsonb;
    END IF;
    
    RETURN blocked_hours_object;
END;
$$ LANGUAGE plpgsql;

-- 10. Comentário explicativo sobre a função
COMMENT ON FUNCTION get_professional_all_blocked_hours(uuid, text) IS 'Retorna todos os horários bloqueados de um profissional (todas as datas) como objeto JSON.';

-- 11. Verificação final - mostra quantos profissionais foram atualizados
SELECT 
    COUNT(*) as total_establishments,
    SUM(array_length(professionals, 1)) as total_professionals
FROM establishments 
WHERE professionals IS NOT NULL AND array_length(professionals, 1) > 0;
