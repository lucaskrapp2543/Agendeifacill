-- Corrige conflitos de agendamento quando `appointments.professional`
-- está misturado entre ID e nome (legado).
-- Estratégia segura:
-- 1) chave canônica por profissional (ID quando possível);
-- 2) se nome for ambíguo (mais de 1 profissional com o mesmo nome), bloqueia gravação;
-- 3) mantém compatibilidade com legado via fallback "name:<nome>".

BEGIN;

CREATE OR REPLACE FUNCTION public.get_professional_conflict_key(
  p_establishment_id uuid,
  p_professional text
)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_professionals jsonb;
  v_input text := btrim(COALESCE(p_professional, ''));
  v_input_norm text := lower(v_input);
  v_elem jsonb;
  v_elem_id text;
  v_elem_name_norm text;
  v_match_count int := 0;
  v_match_id text := NULL;
BEGIN
  IF v_input = '' THEN
    RETURN NULL;
  END IF;

  -- Se já parece UUID, usa direto (chave canônica por ID).
  IF v_input ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RETURN lower(v_input);
  END IF;

  SELECT to_jsonb(e.professionals)
    INTO v_professionals
  FROM public.establishments e
  WHERE e.id = p_establishment_id
  LIMIT 1;

  IF v_professionals IS NULL OR jsonb_typeof(v_professionals) <> 'array' THEN
    RETURN 'name:' || v_input_norm;
  END IF;

  FOR v_elem IN
    SELECT value
    FROM jsonb_array_elements(v_professionals)
  LOOP
    v_elem_id := lower(btrim(COALESCE(v_elem->>'id', '')));
    v_elem_name_norm := lower(btrim(COALESCE(v_elem->>'name', '')));

    -- Compatibilidade extra: valor digitado igual ao ID do profissional.
    IF v_elem_id <> '' AND v_elem_id = v_input_norm THEN
      RETURN v_elem_id;
    END IF;

    -- Nome exato normalizado.
    IF v_elem_name_norm <> '' AND v_elem_name_norm = v_input_norm THEN
      v_match_count := v_match_count + 1;
      IF v_elem_id <> '' THEN
        v_match_id := v_elem_id;
      END IF;
    END IF;
  END LOOP;

  -- Nome resolve para exatamente 1 profissional -> usa ID (seguro).
  IF v_match_count = 1 THEN
    IF COALESCE(v_match_id, '') <> '' THEN
      RETURN v_match_id;
    END IF;
    RETURN 'name:' || v_input_norm;
  END IF;

  -- Nome ambíguo -> retorna NULL para o gatilho bloquear com mensagem clara.
  IF v_match_count > 1 THEN
    RETURN NULL;
  END IF;

  -- Sem match na lista do estabelecimento: mantém fallback por nome legado.
  RETURN 'name:' || v_input_norm;
END;
$$;

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
  v_target_key text;
  v_elem jsonb;
  v_elem_key text;
  v_elem_id text;
  v_elem_name_norm text;
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

  v_target_key := public.get_professional_conflict_key(p_establishment_id, p_professional);
  IF v_target_key IS NULL THEN
    RETURN false;
  END IF;

  FOR v_elem IN
    SELECT value
    FROM jsonb_array_elements(v_professionals)
  LOOP
    v_elem_id := lower(btrim(COALESCE(v_elem->>'id', '')));
    v_elem_name_norm := lower(btrim(COALESCE(v_elem->>'name', '')));
    v_elem_key := NULL;

    IF v_elem_id <> '' THEN
      v_elem_key := v_elem_id;
    ELSIF v_elem_name_norm <> '' THEN
      v_elem_key := 'name:' || v_elem_name_norm;
    END IF;

    IF v_elem_key IS NOT NULL AND v_elem_key = v_target_key THEN
      v_professional := v_elem;
      EXIT;
    END IF;
  END LOOP;

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

    -- Compatibilidade com bloqueios legados de 15 minutos.
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
  v_new_professional_key text;
BEGIN
  IF NEW.status IS NOT NULL AND NEW.status::text = 'cancelled' THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.is_waitlist, false) = true THEN
    RETURN NEW;
  END IF;

  v_new_professional_key := public.get_professional_conflict_key(NEW.establishment_id, NEW.professional);
  IF v_new_professional_key IS NULL THEN
    RAISE EXCEPTION 'Profissional "%" está ambíguo neste estabelecimento. Confirme novamente o profissional antes de salvar.', NEW.professional;
  END IF;

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
    AND appointment_date = NEW.appointment_date
    AND status::text <> 'cancelled'
    AND COALESCE(is_waitlist, false) = false
    AND id <> NEW.id
    AND public.get_professional_conflict_key(establishment_id, professional) = v_new_professional_key
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
