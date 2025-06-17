-- Criar função para cancelar agendamento
CREATE OR REPLACE FUNCTION cancel_appointment(appointment_id UUID)
RETURNS json AS $$
DECLARE
    target_appointment appointments;
BEGIN
    -- Buscar o agendamento
    SELECT * INTO target_appointment
    FROM appointments
    WHERE id = appointment_id;
    
    -- Verificar se o agendamento existe
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Agendamento não encontrado'
        );
    END IF;
    
    -- Verificar se já está cancelado
    IF target_appointment.status = 'cancelled' THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Agendamento já está cancelado'
        );
    END IF;
    
    -- Atualizar o status para cancelado
    UPDATE appointments
    SET status = 'cancelled'
    WHERE id = appointment_id;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Agendamento cancelado com sucesso'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remover política antiga se existir
DROP POLICY IF EXISTS "Cancel own appointments" ON appointments;

-- Criar política simplificada para permitir que clientes cancelem seus próprios agendamentos
CREATE POLICY "Cancel own appointments" ON appointments
    FOR UPDATE
    USING (
        -- Cliente pode cancelar seus próprios agendamentos
        auth.uid() = client_id OR
        -- Estabelecimento pode cancelar seus agendamentos
        auth.uid() = establishment_id OR
        -- Dono do estabelecimento pode cancelar
        EXISTS (
            SELECT 1 FROM establishments e 
            WHERE e.id = appointments.establishment_id 
            AND e.owner_id = auth.uid()
        )
    );

-- Garantir que RLS está habilitado
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Criar função para verificar se usuário pode cancelar agendamento
CREATE OR REPLACE FUNCTION can_cancel_appointment(appointment_id UUID)
RETURNS boolean AS $$
DECLARE
    target_appointment appointments;
BEGIN
    SELECT * INTO target_appointment
    FROM appointments
    WHERE id = appointment_id;
    
    RETURN (
        -- Cliente pode cancelar seus próprios agendamentos
        auth.uid() = target_appointment.client_id OR
        -- Estabelecimento pode cancelar seus agendamentos
        auth.uid() = target_appointment.establishment_id OR
        -- Dono do estabelecimento pode cancelar
        EXISTS (
            SELECT 1 FROM establishments e 
            WHERE e.id = target_appointment.establishment_id 
            AND e.owner_id = auth.uid()
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 