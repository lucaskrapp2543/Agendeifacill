-- Criar tabela de notificações
CREATE TABLE IF NOT EXISTS establishment_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    establishment_id UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('new_appointment', 'cancelled_appointment')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_notifications_establishment ON establishment_notifications(establishment_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON establishment_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON establishment_notifications(read);

-- Habilitar RLS
ALTER TABLE establishment_notifications ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Estabelecimentos podem ver suas notificações" ON establishment_notifications
    FOR SELECT USING (
        establishment_id IN (
            SELECT id FROM establishments WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Estabelecimentos podem inserir suas notificações" ON establishment_notifications
    FOR INSERT WITH CHECK (
        establishment_id IN (
            SELECT id FROM establishments WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Estabelecimentos podem atualizar suas notificações" ON establishment_notifications
    FOR UPDATE USING (
        establishment_id IN (
            SELECT id FROM establishments WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Estabelecimentos podem deletar suas notificações" ON establishment_notifications
    FOR DELETE USING (
        establishment_id IN (
            SELECT id FROM establishments WHERE owner_id = auth.uid()
        )
    );

-- Função para notificação de novo agendamento
CREATE OR REPLACE FUNCTION create_appointment_notification()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO establishment_notifications (
        establishment_id,
        type,
        title,
        message,
        appointment_id
    ) VALUES (
        NEW.establishment_id,
        'new_appointment',
        'Novo Agendamento!',
        NEW.client_name || ' agendou ' || NEW.service || ' para ' || NEW.appointment_date || ' às ' || NEW.appointment_time,
        NEW.id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para novo agendamento
DROP TRIGGER IF EXISTS trigger_create_appointment_notification ON appointments;
CREATE TRIGGER trigger_create_appointment_notification
    AFTER INSERT ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION create_appointment_notification();

-- Função para notificação de cancelamento
CREATE OR REPLACE FUNCTION create_cancellation_notification()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status != 'cancelled' AND NEW.status = 'cancelled' THEN
        INSERT INTO establishment_notifications (
            establishment_id,
            type,
            title,
            message,
            appointment_id
        ) VALUES (
            NEW.establishment_id,
            'cancelled_appointment',
            'Agendamento Cancelado!',
            NEW.client_name || ' cancelou ' || NEW.service || ' de ' || NEW.appointment_date || ' às ' || NEW.appointment_time,
            NEW.id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para cancelamento
DROP TRIGGER IF EXISTS trigger_create_cancellation_notification ON appointments;
CREATE TRIGGER trigger_create_cancellation_notification
    AFTER UPDATE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION create_cancellation_notification();
