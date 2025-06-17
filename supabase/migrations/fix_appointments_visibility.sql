-- Remover políticas antigas
DROP POLICY IF EXISTS "View appointments" ON appointments;
DROP POLICY IF EXISTS "Create appointments" ON appointments;
DROP POLICY IF EXISTS "Update appointments" ON appointments;

-- Criar novas políticas de segurança que permitem ver TODOS os agendamentos
CREATE POLICY "View all appointments" ON appointments
  FOR SELECT
  USING (true); -- Permite que qualquer usuário autenticado veja todos os agendamentos

CREATE POLICY "Create appointments if authenticated" ON appointments
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Update own appointments" ON appointments
  FOR UPDATE
  USING (
    auth.uid() = client_id OR 
    auth.uid() = establishment_id OR
    EXISTS (
      SELECT 1 FROM establishments e 
      WHERE e.id = appointments.establishment_id 
      AND e.owner_id = auth.uid()
    )
  );

-- Atualizar a função de verificação de conflitos para ser mais explícita
CREATE OR REPLACE FUNCTION check_appointment_conflict()
RETURNS trigger AS $$
DECLARE
  conflicting_appointment appointments;
BEGIN
  -- Verificar se existe algum agendamento que se sobrepõe
  SELECT * INTO conflicting_appointment
  FROM appointments
  WHERE 
    establishment_id = NEW.establishment_id
    AND professional = NEW.professional
    AND appointment_date = NEW.appointment_date
    AND status != 'cancelled'
    AND id != NEW.id
    AND appointments_overlap(
      NEW.appointment_time::time,
      NEW.duration,
      appointment_time::time,
      duration
    )
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Horário % já está reservado para outro cliente. Por favor, escolha outro horário.', NEW.appointment_time;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql; 