-- =====================================================
-- SISTEMA DE AUSÊNCIAS DOS PROFISSIONAIS - MIGRAÇÃO FINAL
-- =====================================================
-- Esta migração adiciona o campo 'absences' aos profissionais
-- e garante compatibilidade com funcionalidades existentes

-- 1. Adicionar comentário explicativo sobre o campo de ausências
COMMENT ON COLUMN establishments.professionals IS 'Array de profissionais com campos: id, name, specialties, percentage (percentual do profissional - padrão 100%), absences (array de datas de ausência no formato YYYY-MM-DD), photo_url (URL da foto do profissional)';

-- 2. Função para atualizar profissionais existentes com campo de ausências
CREATE OR REPLACE FUNCTION add_absences_field_to_professionals()
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
            
            -- Adiciona campo de ausências vazio se não existir
            IF NOT (professional ? 'absences') THEN
                professional := professional || '{"absences": []}'::jsonb;
                total_updated := total_updated + 1;
            END IF;
            
            updated_professionals := array_append(updated_professionals, professional);
        END LOOP;
        
        -- Atualiza o estabelecimento com os profissionais atualizados
        UPDATE establishments 
        SET professionals = updated_professionals 
        WHERE id = establishment_record.id;
        
        RAISE NOTICE 'Estabelecimento "%" atualizado com % profissionais', establishment_record.name, array_length(updated_professionals, 1);
    END LOOP;
    
    RAISE NOTICE 'Migração concluída: % profissionais atualizados com campo de ausências', total_updated;
END;
$$ LANGUAGE plpgsql;

-- 3. Executa a função para adicionar campo de ausências aos profissionais existentes
SELECT add_absences_field_to_professionals();

-- 4. Remove a função temporária
DROP FUNCTION add_absences_field_to_professionals();

-- 5. Função para verificar se um profissional está ausente em uma data específica
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

-- 6. Comentário explicativo sobre a função
COMMENT ON FUNCTION is_professional_absent(uuid, text, text) IS 'Verifica se um profissional específico está ausente em uma data específica. Retorna true se o profissional estiver ausente, false caso contrário.';

-- 7. Função para obter todas as ausências de um profissional
CREATE OR REPLACE FUNCTION get_professional_absences(
    establishment_id_param uuid,
    professional_id_param text
)
RETURNS text[] AS $$
DECLARE
    professional_record jsonb;
    absences_array jsonb;
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
    
    -- Obtém o array de ausências
    absences_array := professional_record->'absences';
    
    -- Verifica se o array de ausências existe
    IF absences_array IS NULL OR jsonb_typeof(absences_array) != 'array' THEN
        RETURN ARRAY[]::text[];
    END IF;
    
    -- Converte para array de strings
    SELECT ARRAY(
        SELECT jsonb_array_elements_text(absences_array)
    ) INTO result;
    
    RETURN COALESCE(result, ARRAY[]::text[]);
END;
$$ LANGUAGE plpgsql;

-- 8. Comentário explicativo sobre a função
COMMENT ON FUNCTION get_professional_absences(uuid, text) IS 'Retorna todas as datas de ausência de um profissional específico como array de strings.';

-- 9. Verificação final - mostra quantos profissionais foram atualizados
SELECT 
    COUNT(*) as total_establishments,
    SUM(array_length(professionals, 1)) as total_professionals,
    SUM(
        (
            SELECT COUNT(*)
            FROM jsonb_array_elements(p.professionals) as prof
            WHERE prof ? 'absences'
        )
    ) as professionals_with_absences
FROM establishments p
WHERE professionals IS NOT NULL AND array_length(professionals, 1) > 0;

-- 10. Exemplo de uso das funções:
-- Verificar se um profissional está ausente:
-- SELECT is_professional_absent('uuid-do-estabelecimento', 'id-do-profissional', '2025-01-20');

-- Obter todas as ausências de um profissional:
-- SELECT get_professional_absences('uuid-do-estabelecimento', 'id-do-profissional');

RAISE NOTICE 'Sistema de ausências dos profissionais implementado com sucesso!';
RAISE NOTICE 'Funções criadas: is_professional_absent() e get_professional_absences()';
RAISE NOTICE 'Campo absences adicionado a todos os profissionais existentes';
