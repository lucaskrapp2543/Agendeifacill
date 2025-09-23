-- Sistema de Horários de Trabalho dos Profissionais
-- Permite que cada profissional defina seus próprios horários de trabalho

-- Adiciona campo de horários de trabalho aos profissionais existentes
-- Função para atualizar profissionais existentes com horários de trabalho
CREATE OR REPLACE FUNCTION update_existing_professionals_with_work_hours()
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
            
            -- Adiciona horários de trabalho padrão se não existir
            IF NOT (professional ? 'work_hours') THEN
                professional := professional || '{"work_hours": null}'::jsonb;
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
SELECT update_existing_professionals_with_work_hours();

-- Remove a função temporária
DROP FUNCTION update_existing_professionals_with_work_hours();

-- Comentário explicativo
COMMENT ON COLUMN establishments.professionals IS 'Array de profissionais com campos: id, name, specialties, percentage, photo_url, offers_child_service, work_hours (horários personalizados de trabalho - null usa horário padrão do estabelecimento)';

-- Estrutura esperada para work_hours:
-- {
--   "monday": {
--     "enabled": true,
--     "entry_time": "08:00",
--     "break_start": "12:00", 
--     "break_end": "13:00",
--     "exit_time": "17:00"
--   },
--   "tuesday": {
--     "enabled": true,
--     "entry_time": "08:00",
--     "break_start": "12:00",
--     "break_end": "13:00", 
--     "exit_time": "17:00"
--   },
--   "wednesday": {
--     "enabled": false
--   },
--   "thursday": {
--     "enabled": true,
--     "entry_time": "08:00",
--     "break_start": "12:00",
--     "break_end": "13:00",
--     "exit_time": "17:00"
--   },
--   "friday": {
--     "enabled": true,
--     "entry_time": "08:00",
--     "break_start": "12:00",
--     "break_end": "13:00",
--     "exit_time": "17:00"
--   },
--   "saturday": {
--     "enabled": true,
--     "entry_time": "08:00",
--     "break_start": null,
--     "break_end": null,
--     "exit_time": "12:00"
--   },
--   "sunday": {
--     "enabled": false
--   }
-- }
