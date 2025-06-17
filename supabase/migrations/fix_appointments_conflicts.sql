-- Criar extensão btree_gist se não existir
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Remover constraint antiga se existir
ALTER TABLE appointments 
DROP CONSTRAINT IF EXISTS no_overlapping_appointments;

-- Adicionar função para verificar sobreposição de horários
CREATE OR REPLACE FUNCTION appointments_overlap(
  time1 time,
  duration1 int,
  time2 time,
  duration2 int
) RETURNS boolean AS $$
BEGIN
  RETURN NOT (
    time1 >= (time2 + (duration2 || ' minutes')::interval) OR
    (time1 + (duration1 || ' minutes')::interval) <= time2
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Criar trigger para verificar conflitos antes de inserir ou atualizar
CREATE OR REPLACE FUNCTION check_appointment_conflict()
RETURNS trigger AS $$
DECLARE
  conflicting_appointment appointments;
BEGIN
  -- Verificar se existe algum agendamento que se sobrepõe
  -- Agora verifica QUALQUER agendamento no mesmo horário, independente do cliente
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
    RAISE EXCEPTION 'Horário indisponível! Já existe um agendamento às %', conflicting_appointment.appointment_time;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recriar trigger
DROP TRIGGER IF EXISTS check_appointment_conflict_trigger ON appointments;
CREATE TRIGGER check_appointment_conflict_trigger
  BEFORE INSERT OR UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION check_appointment_conflict();

-- Remover políticas antigas
DROP POLICY IF EXISTS "Prevent conflicting appointments" ON appointments;
DROP POLICY IF EXISTS "Enable read access for users" ON appointments;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON appointments;
DROP POLICY IF EXISTS "Enable update for users based on role" ON appointments;

-- Criar novas políticas de segurança
CREATE POLICY "View appointments" ON appointments
  FOR SELECT
  USING (
    -- Usuários podem ver seus próprios agendamentos
    auth.uid() = client_id OR 
    -- Estabelecimentos podem ver agendamentos feitos para eles
    auth.uid() = establishment_id OR
    -- Donos de estabelecimentos podem ver agendamentos
    EXISTS (
      SELECT 1 FROM establishments e 
      WHERE e.id = appointments.establishment_id 
      AND e.owner_id = auth.uid()
    )
  );

CREATE POLICY "Create appointments" ON appointments
  FOR INSERT
  WITH CHECK (
    -- Qualquer usuário autenticado pode criar agendamento
    -- A verificação de conflito é feita pelo trigger
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Update appointments" ON appointments
  FOR UPDATE
  USING (
    -- Clientes podem atualizar seus próprios agendamentos
    auth.uid() = client_id OR
    -- Estabelecimentos podem atualizar seus agendamentos
    auth.uid() = establishment_id OR
    -- Donos de estabelecimentos podem atualizar
    EXISTS (
      SELECT 1 FROM establishments e 
      WHERE e.id = appointments.establishment_id 
      AND e.owner_id = auth.uid()
    )
  );

-- Criar índice parcial para garantir unicidade de horários não cancelados
DROP INDEX IF EXISTS idx_unique_active_appointments;
CREATE UNIQUE INDEX idx_unique_active_appointments
  ON appointments (establishment_id, professional, appointment_date, appointment_time)
  WHERE status != 'cancelled';

-- Criar índice para melhorar performance das verificações
DROP INDEX IF EXISTS idx_appointments_overlap;
CREATE INDEX idx_appointments_overlap
  ON appointments (establishment_id, professional, appointment_date, appointment_time, status); 