-- Reforça a trava de horários bloqueados diretamente no banco.
-- É idempotente e seguro para colar novamente no Supabase.

BEGIN;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS allow_blocked_override boolean NOT NULL DEFAULT false;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS is_waitlist boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.appointments_overlap(
  time1 time,
  duration1 int,
  time2 time,
  duration2 int
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN NOT (
    time1 >= (time2 + (GREATEST(COALESCE(duration2, 30), 1) || ' minutes')::interval)
    OR (time1 + (GREATEST(COALESCE(duration1, 30), 1) || ' minutes')::interval) <= time2
  );
END;
$$;

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

    IF v_elem_id <> '' AND v_elem_id = v_input_norm THEN
      RETURN v_elem_id;
    END IF;

    IF v_elem_name_norm <> '' AND v_elem_name_norm = v_input_norm THEN
      v_match_count := v_match_count + 1;
      IF v_elem_id <> '' THEN
        v_match_id := v_elem_id;
      END IF;
    END IF;
  END LOOP;

  IF v_match_count = 1 THEN
    IF COALESCE(v_match_id, '') <> '' THEN
      RETURN v_match_id;
    END IF;
    RETURN 'name:' || v_input_norm;
  END IF;

  IF v_match_count > 1 THEN
    RETURN NULL;
  END IF;

  RETURN 'name:' || v_input_norm;
END;
$$;

CREATE OR REPLACE FUNCTION public.parse_duration_minutes_text(
  p_raw text,
  p_fallback int DEFAULT 30
)
RETURNS int
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_raw text := lower(btrim(COALESCE(p_raw, '')));
  v_num numeric;
  v_match text[];
BEGIN
  IF v_raw = '' THEN
    RETURN GREATEST(COALESCE(p_fallback, 30), 0);
  END IF;

  IF v_raw ~ '^\d{1,2}:\d{2}$' THEN
    RETURN GREATEST((split_part(v_raw, ':', 1)::int * 60) + split_part(v_raw, ':', 2)::int, 0);
  END IF;

  IF v_raw ~ '^-?\d+(\.\d+)?$' THEN
    v_num := v_raw::numeric;
    IF v_num > 0 THEN
      RETURN ROUND(v_num)::int;
    END IF;
    RETURN GREATEST(COALESCE(p_fallback, 30), 0);
  END IF;

  v_match := regexp_match(v_raw, '(\d+(?:[.,]\d+)?)\s*(h|hr|hrs|hora|horas)\b');
  IF v_match IS NOT NULL THEN
    v_num := replace(v_match[1], ',', '.')::numeric;
    IF v_num > 0 THEN
      RETURN GREATEST(ROUND(v_num * 60)::int, 1);
    END IF;
  END IF;

  v_match := regexp_match(v_raw, '(\d+)\s*(m|min|mins|minuto|minutos)\b');
  IF v_match IS NOT NULL THEN
    v_num := v_match[1]::numeric;
    IF v_num > 0 THEN
      RETURN ROUND(v_num)::int;
    END IF;
  END IF;

  v_match := regexp_match(v_raw, '(\d+)');
  IF v_match IS NOT NULL THEN
    v_num := v_match[1]::numeric;
    IF v_num > 0 THEN
      RETURN ROUND(v_num)::int;
    END IF;
  END IF;

  RETURN GREATEST(COALESCE(p_fallback, 30), 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.additional_products_duration_minutes(
  p_additional_products jsonb
)
RETURNS int
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_total int := 0;
  v_item jsonb;
BEGIN
  IF p_additional_products IS NULL OR jsonb_typeof(p_additional_products) <> 'array' THEN
    RETURN 0;
  END IF;

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_additional_products)
  LOOP
    v_total := v_total + public.parse_duration_minutes_text(v_item->>'duration', 0);
  END LOOP;

  RETURN GREATEST(v_total, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.appointment_row_duration_minutes(
  p_row jsonb
)
RETURNS int
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN GREATEST(
    public.parse_duration_minutes_text(p_row->>'duration', 30)
    + public.additional_products_duration_minutes(p_row->'additional_products'),
    1
  );
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
  WHERE btrim(COALESCE(elem->>'id', '')) = btrim(COALESCE(p_professional, ''))
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
  v_new_professional_key text;
  v_new_duration int;
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

  v_new_duration := public.appointment_row_duration_minutes(to_jsonb(NEW));

  IF COALESCE(NEW.allow_blocked_override, false) = false
    AND public.is_appointment_time_blocked(
      NEW.establishment_id,
      NEW.professional,
      NEW.appointment_date,
      NEW.appointment_time::time,
      v_new_duration
    )
  THEN
    RAISE EXCEPTION 'Horário % está bloqueado para este profissional. Escolha outro horário.', NEW.appointment_time;
  END IF;

  SELECT a.*
    INTO conflicting_appointment
  FROM public.appointments a
  WHERE a.establishment_id = NEW.establishment_id
    AND a.appointment_date = NEW.appointment_date
    AND a.status::text <> 'cancelled'
    AND COALESCE(a.is_waitlist, false) = false
    AND a.id <> NEW.id
    AND public.get_professional_conflict_key(a.establishment_id, a.professional) = v_new_professional_key
    AND public.appointments_overlap(
      NEW.appointment_time::time,
      v_new_duration,
      a.appointment_time::time,
      public.appointment_row_duration_minutes(to_jsonb(a))
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
