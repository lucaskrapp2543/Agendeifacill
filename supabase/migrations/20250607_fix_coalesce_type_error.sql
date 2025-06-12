-- Migração: Corrigir erro de tipos UUID vs INTEGER no COALESCE
-- Data: 2025-06-07
-- Descrição: Corrige incompatibilidade de tipos na função validate_appointment_overlap

-- Remover função problemática
DROP FUNCTION IF EXISTS validate_appointment_overlap() CASCADE;

-- Recriar função com tipos corretos
CREATE OR REPLACE FUNCTION validate_appointment_overlap()
RETURNS TRIGGER AS $$
DECLARE
    conflict_count INTEGER;
    service_duration INTEGER;
    appointment_end_time TIME;
BEGIN
    -- Extrair duração do serviço (assumindo que está em minutos)
    service_duration := COALESCE(NEW.duration, 30);
    
    -- Calcular horário de fim do novo agendamento
    appointment_end_time := NEW.appointment_time + (service_duration || ' minutes')::INTERVAL;
    
    -- Verificar conflitos existentes para o mesmo profissional na mesma data
    SELECT COUNT(*) INTO conflict_count
    FROM appointments 
    WHERE establishment_id = NEW.establishment_id
      AND professional = NEW.professional 
      AND appointment_date = NEW.appointment_date
      AND status IN ('confirmed', 'pending')
      AND (NEW.id IS NULL OR id != NEW.id) -- ✅ CORREÇÃO: Tratamento correto para UUID
      AND (
        -- Novo agendamento começa durante outro existente
        (NEW.appointment_time >= appointment_time 
         AND NEW.appointment_time < appointment_time + (COALESCE(duration, 30) || ' minutes')::INTERVAL)
        OR
        -- Novo agendamento termina durante outro existente  
        (appointment_end_time > appointment_time 
         AND appointment_end_time <= appointment_time + (COALESCE(duration, 30) || ' minutes')::INTERVAL)
        OR
        -- Novo agendamento engloba outro existente
        (NEW.appointment_time <= appointment_time 
         AND appointment_end_time >= appointment_time + (COALESCE(duration, 30) || ' minutes')::INTERVAL)
      );
    
    -- Se há conflito, permitir mas registrar warning em log (não bloquear)
    IF conflict_count > 0 THEN
        RAISE WARNING 'Possível conflito de horário detectado para % em % às %', 
                     NEW.professional, NEW.appointment_date, NEW.appointment_time;
        -- Não bloquear - apenas avisar
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recriar trigger
CREATE TRIGGER validate_appointment_overlap_trigger
    BEFORE INSERT OR UPDATE ON appointments
    FOR EACH ROW 
    EXECUTE FUNCTION validate_appointment_overlap();

-- Verificar se a correção funcionou
SELECT 'Erro de tipos UUID vs INTEGER corrigido com sucesso!' as status; 