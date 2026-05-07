-- Corrige conflito de horário considerando duração efetiva da linha:
-- - base: duration
-- - extras: additional_products[].duration
-- Mantém compatibilidade com fluxo antigo e com override interno de horários bloqueados.

BEGIN;

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
  v_h text;
  v_m text;
  v_num numeric;
  v_match text[];
BEGIN
  IF v_raw = '' THEN
    RETURN GREATEST(COALESCE(p_fallback, 30), 0);
  END IF;

  -- hh:mm
  IF v_raw ~ '^\d{1,2}:\d{2}$' THEN
    v_h := split_part(v_raw, ':', 1);
    v_m := split_part(v_raw, ':', 2);
    RETURN GREATEST((COALESCE(v_h, '0')::int * 60) + COALESCE(v_m, '0')::int, 0);
  END IF;

  -- numérico puro
  IF v_raw ~ '^-?\d+(\.\d+)?$' THEN
    v_num := v_raw::numeric;
    IF v_num > 0 THEN
      RETURN ROUND(v_num)::int;
    END IF;
    RETURN GREATEST(COALESCE(p_fallback, 30), 0);
  END IF;

  -- horas (ex: 1.5h, 2 horas)
  v_match := regexp_match(v_raw, '(\d+(?:[.,]\d+)?)\s*(h|hr|hrs|hora|horas)\b');
  IF v_match IS NOT NULL THEN
    v_num := replace(v_match[1], ',', '.')::numeric;
    IF v_num > 0 THEN
      RETURN GREATEST(ROUND(v_num * 60)::int, 1);
    END IF;
  END IF;

  -- minutos textuais (ex: 30min)
  v_match := regexp_match(v_raw, '(\d+)\s*(m|min|mins|minuto|minutos)\b');
  IF v_match IS NOT NULL THEN
    v_num := v_match[1]::numeric;
    IF v_num > 0 THEN
      RETURN ROUND(v_num)::int;
    END IF;
  END IF;

  -- fallback: primeiro número encontrado
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
DECLARE
  v_base int;
  v_extra int;
BEGIN
  v_base := public.parse_duration_minutes_text(p_row->>'duration', 30);
  v_extra := public.additional_products_duration_minutes(p_row->'additional_products');
  RETURN GREATEST(v_base + v_extra, 1);
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
  can_override_blocked := COALESCE(NEW.allow_blocked_override, false) = true;

  IF NOT can_override_blocked AND public.is_appointment_time_blocked(
    NEW.establishment_id,
    NEW.professional,
    NEW.appointment_date,
    NEW.appointment_time::time,
    v_new_duration
  ) THEN
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
