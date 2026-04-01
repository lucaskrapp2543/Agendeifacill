-- COLE NO SUPABASE SQL EDITOR
-- Garante bloqueio de horarios no banco (independente do frontend).

BEGIN;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS allow_blocked_override boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.is_appointment_time_blocked(
  p_establishment_id uuid,
  p_professional text,
  p_appointment_date date,
  p_appointment_time time,
  p_duration_minutes int DEFAULT 30
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_professionals jsonb;
  v_professional jsonb;
  v_blocked_for_date jsonb;
  v_block_time_text text;
  v_block_start time;
  v_block_end time;
  v_appointment_start time := p_appointment_time;
  v_appointment_end time := p_appointment_time + make_interval(mins => GREATEST(COALESCE(p_duration_minutes, 30), 1));
BEGIN
  SELECT to_jsonb(e.professionals)
    INTO v_professionals
  FROM public.establishments e
  WHERE e.id = p_establishment_id
  LIMIT 1;

  IF v_professionals IS NULL OR jsonb_typeof(v_professionals) <> 'array' THEN
    RETURN false;
  END IF;

  SELECT elem
    INTO v_professional
  FROM jsonb_array_elements(v_professionals) AS elem
  WHERE
    btrim(COALESCE(elem->>'id', '')) = btrim(COALESCE(p_professional, ''))
    OR lower(btrim(COALESCE(elem->>'name', ''))) = lower(btrim(COALESCE(p_professional, '')))
  LIMIT 1;

  IF v_professional IS NULL THEN
    RETURN false;
  END IF;

  v_blocked_for_date := COALESCE(
    v_professional->'blocked_hours'->to_char(p_appointment_date, 'YYYY-MM-DD'),
    '[]'::jsonb
  );

  IF jsonb_typeof(v_blocked_for_date) <> 'array' THEN
    RETURN false;
  END IF;

  FOR v_block_time_text IN
    SELECT jsonb_array_elements_text(v_blocked_for_date)
  LOOP
    BEGIN
      v_block_start := btrim(v_block_time_text)::time;
    EXCEPTION
      WHEN others THEN
        CONTINUE;
    END;

    v_block_end := v_block_start + interval '15 minutes';

    IF v_appointment_start < v_block_end AND v_appointment_end > v_block_start THEN
      RETURN true;
    END IF;
  END LOOP;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_appointment_conflict()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  conflicting_appointment public.appointments;
  can_override_blocked boolean := false;
BEGIN
  IF NEW.status IS NOT NULL AND NEW.status::text = 'cancelled' THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.is_waitlist, false) = true THEN
    RETURN NEW;
  END IF;

  -- Override permitido apenas no agendamento interno com flag explicita.
  -- Booking público e demais fluxos antigos continuam bloqueados normalmente.
  can_override_blocked := COALESCE(NEW.allow_blocked_override, false) = true;

  IF NOT can_override_blocked AND public.is_appointment_time_blocked(
    NEW.establishment_id,
    NEW.professional,
    NEW.appointment_date,
    NEW.appointment_time::time,
    NEW.duration
  ) THEN
    RAISE EXCEPTION 'Horário % está bloqueado para este profissional. Escolha outro horário.', NEW.appointment_time;
  END IF;

  SELECT *
    INTO conflicting_appointment
  FROM public.appointments
  WHERE establishment_id = NEW.establishment_id
    AND professional = NEW.professional
    AND appointment_date = NEW.appointment_date
    AND status::text <> 'cancelled'
    AND COALESCE(is_waitlist, false) = false
    AND id <> NEW.id
    AND public.appointments_overlap(
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
$$;

DROP TRIGGER IF EXISTS check_appointment_conflict_trigger ON public.appointments;
CREATE TRIGGER check_appointment_conflict_trigger
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.check_appointment_conflict();

COMMIT;

NOTIFY pgrst, 'reload schema';
