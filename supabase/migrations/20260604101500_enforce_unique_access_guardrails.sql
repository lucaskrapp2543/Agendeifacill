-- Guardrails de segurança para Acesso Único Profissional.
-- 1) Não permite Acesso Único ativo sem senha válida de 4 dígitos (e diferente de 0000)
-- 2) Garante que exista ao menos 1 profissional do tipo DONO por estabelecimento

CREATE OR REPLACE FUNCTION public.validate_unique_access_guardrails()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  professional_item jsonb;
  pin_item jsonb;
  professional_id text;
  professional_pin text;
  role_raw text;
  unique_enabled boolean;
  has_owner boolean := false;
BEGIN
  IF jsonb_typeof(COALESCE(NEW.professionals, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'professionals deve ser um array JSON';
  END IF;

  IF jsonb_typeof(COALESCE(NEW.professionals_pins, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'professionals_pins deve ser um array JSON';
  END IF;

  -- Regra: nunca permitir estabelecimento sem ao menos 1 DONO
  FOR professional_item IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(NEW.professionals, '[]'::jsonb))
  LOOP
    role_raw := lower(COALESCE(trim(professional_item->>'unique_professional_access_role'), 'owner'));
    IF role_raw <> 'collaborator' THEN
      has_owner := true;
    END IF;
  END LOOP;

  IF jsonb_array_length(COALESCE(NEW.professionals, '[]'::jsonb)) > 0 AND NOT has_owner THEN
    RAISE EXCEPTION 'É necessário existir pelo menos 1 profissional do tipo DONO no estabelecimento.';
  END IF;

  -- Regra: Acesso Único só com senha válida de 4 dígitos
  FOR professional_item IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(NEW.professionals, '[]'::jsonb))
  LOOP
    unique_enabled :=
      lower(COALESCE(professional_item->>'unique_professional_access_enabled', 'false')) IN ('true', 't', '1');
    IF NOT unique_enabled THEN
      CONTINUE;
    END IF;

    professional_id := NULLIF(trim(professional_item->>'id'), '');
    IF professional_id IS NULL THEN
      RAISE EXCEPTION 'Profissional com Acesso Único precisa ter id válido.';
    END IF;

    professional_pin := NULL;
    FOR pin_item IN
      SELECT value
      FROM jsonb_array_elements(COALESCE(NEW.professionals_pins, '[]'::jsonb))
    LOOP
      IF trim(COALESCE(pin_item->>'professional_id', '')) = professional_id THEN
        professional_pin := trim(COALESCE(pin_item->>'pin', ''));
        EXIT;
      END IF;
    END LOOP;

    IF professional_pin IS NULL
      OR professional_pin !~ '^[0-9]{4}$'
      OR professional_pin = '0000' THEN
      RAISE EXCEPTION 'Cadastre uma senha de 4 dígitos para este profissional antes de ativar o Acesso Único Profissional.';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_unique_access_guardrails_trigger ON public.establishments;

CREATE TRIGGER validate_unique_access_guardrails_trigger
BEFORE INSERT OR UPDATE OF professionals, professionals_pins
ON public.establishments
FOR EACH ROW
EXECUTE FUNCTION public.validate_unique_access_guardrails();
