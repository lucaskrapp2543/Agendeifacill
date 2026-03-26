-- Correção segura de conflitos de agendamento:
-- 1) Não revalidar bloqueio/conflito quando o UPDATE altera apenas status/campos administrativos.
-- 2) Comparar profissional por referência canônica (id OU nome), evitando divergência entre fluxos interno/booking.
-- 3) Manter compatibilidade com regra de override de bloqueio no dia atual.
--
-- Seguro para rodar mais de uma vez.

BEGIN;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS allow_blocked_override boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.normalize_professional_ref(
  p_establishment_id uuid,
  p_professional text
)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_professionals jsonb;
  v_professional jsonb;
  v_ref text;
BEGIN
  v_ref := lower(btrim(COALESCE(p_professional, '')));
  IF v_ref = '' THEN
    RETURN '';
  END IF;

  SELECT to_jsonb(e.professionals)
    INTO v_professionals
  FROM public.establishments e
  WHERE e.id = p_establishment_id
  LIMIT 1;

  IF v_professionals IS NULL OR jsonb_typeof(v_professionals) <> 'array' THEN
    RETURN v_ref;
  END IF;

  SELECT elem
    INTO v_professional
  FROM jsonb_array_elements(v_professionals) AS elem
  WHERE
    btrim(COALESCE(elem->>'id', '')) = btrim(COALESCE(p_professional, ''))
    OR lower(btrim(COALESCE(elem->>'name', ''))) = lower(btrim(COALESCE(p_professional, '')))
  LIMIT 1;

  IF v_professional IS NULL THEN
    RETURN v_ref;
  END IF;

  -- Preferir id canônico quando existir.
  RETURN lower(
    btrim(
      COALESCE(
        NULLIF(v_professional->>'id', ''),
        NULLIF(v_professional->>'name', ''),
        p_professional
      )
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.check_appointment_conflict()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  conflicting_appointment public.appointments;
  can_override_blocked boolean := false;
  new_professional_ref text;
BEGIN
  -- Nunca bloquear cancelamento.
  IF NEW.status IS NOT NULL AND NEW.status::text = 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- Waitlist mantém comportamento próprio.
  IF COALESCE(NEW.is_waitlist, false) = true THEN
    RETURN NEW;
  END IF;

  -- UPDATE só de status/campos administrativos não deve revalidar grade.
  -- Evita erro ao concluir agendamento antigo que hoje está sobre bloqueio.
  IF TG_OP = 'UPDATE'
     AND NEW.establishment_id IS NOT DISTINCT FROM OLD.establishment_id
     AND NEW.professional IS NOT DISTINCT FROM OLD.professional
     AND NEW.appointment_date IS NOT DISTINCT FROM OLD.appointment_date
     AND NEW.appointment_time IS NOT DISTINCT FROM OLD.appointment_time
     AND COALESCE(NEW.duration, 30) IS NOT DISTINCT FROM COALESCE(OLD.duration, 30)
     AND COALESCE(NEW.is_waitlist, false) IS NOT DISTINCT FROM COALESCE(OLD.is_waitlist, false)
     AND COALESCE(NEW.allow_blocked_override, false) IS NOT DISTINCT FROM COALESCE(OLD.allow_blocked_override, false)
  THEN
    RETURN NEW;
  END IF;

  -- Override de bloqueio permitido apenas com flag explícita no dia atual.
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

  new_professional_ref := public.normalize_professional_ref(NEW.establishment_id, NEW.professional);

  SELECT *
    INTO conflicting_appointment
  FROM public.appointments
  WHERE establishment_id = NEW.establishment_id
    AND appointment_date = NEW.appointment_date
    AND status::text <> 'cancelled'
    AND COALESCE(is_waitlist, false) = false
    AND id <> NEW.id
    AND public.normalize_professional_ref(establishment_id, professional) = new_professional_ref
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
