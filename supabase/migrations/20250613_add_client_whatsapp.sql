-- Adicionar coluna de WhatsApp na tabela appointments
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS client_whatsapp TEXT;

-- Criar índice para facilitar buscas por WhatsApp
CREATE INDEX IF NOT EXISTS idx_appointments_whatsapp ON appointments(client_whatsapp);

-- Atualizar a função de criação de agendamentos para incluir o WhatsApp
CREATE OR REPLACE FUNCTION create_appointment(
  p_client_id UUID,
  p_establishment_id UUID,
  p_service TEXT,
  p_professional TEXT,
  p_appointment_date DATE,
  p_appointment_time TEXT,
  p_client_name TEXT,
  p_client_whatsapp TEXT,
  p_duration INTEGER,
  p_price DECIMAL,
  p_payment_method TEXT DEFAULT 'pendente'
) RETURNS appointments AS $$
DECLARE
  v_appointment appointments;
BEGIN
  INSERT INTO appointments (
    client_id,
    establishment_id,
    service,
    professional,
    appointment_date,
    appointment_time,
    client_name,
    client_whatsapp,
    duration,
    price,
    payment_method
  ) VALUES (
    p_client_id,
    p_establishment_id,
    p_service,
    p_professional,
    p_appointment_date,
    p_appointment_time,
    p_client_name,
    p_client_whatsapp,
    p_duration,
    p_price,
    p_payment_method
  )
  RETURNING * INTO v_appointment;

  RETURN v_appointment;
END;
$$ LANGUAGE plpgsql; 