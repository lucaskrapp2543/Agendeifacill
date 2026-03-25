-- Permite override de horário bloqueado APENAS no agendamento interno do dia atual.
-- Compatível e não destrutivo: adiciona coluna opcional e preserva regras antigas por padrão.

BEGIN;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS allow_blocked_override boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.check_appointment_conflict()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  conflicting_appointment public.appointments;
  can_override_blocked boolean := false;
BEGIN
  -- Never block cancellation flow.
  IF NEW.status IS NOT NULL AND NEW.status::text = 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- Waitlist keeps its own behavior.
  IF COALESCE(NEW.is_waitlist, false) = true THEN
    RETURN NEW;
  END IF;

  -- Override de bloqueio só é aceito no dia atual e com flag explícita.
  -- Isso mantém Booking e demais fluxos antigos protegidos.
  can_override_blocked := COALESCE(NEW.allow_blocked_override, false) = true
    AND NEW.appointment_date = CURRENT_DATE;

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

COMMIT;

NOTIFY pgrst, 'reload schema';
