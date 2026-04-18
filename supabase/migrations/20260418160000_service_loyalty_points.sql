-- Pontos de fidelidade por serviço (subcategoria) + soma gravada no agendamento ao concluir.

BEGIN;

ALTER TABLE public.service_subcategories
  ADD COLUMN IF NOT EXISTS loyalty_points integer NOT NULL DEFAULT 0;

ALTER TABLE public.service_subcategories
  DROP CONSTRAINT IF EXISTS service_subcategories_loyalty_points_check;

ALTER TABLE public.service_subcategories
  ADD CONSTRAINT service_subcategories_loyalty_points_check CHECK (loyalty_points >= 0);

COMMENT ON COLUMN public.service_subcategories.loyalty_points IS
  'Quantidade de pontos de fidelidade somados ao concluir o atendimento (cliente não assinante).';

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS loyalty_points_awarded integer;

COMMENT ON COLUMN public.appointments.loyalty_points_awarded IS
  'Pontos de fidelidade a somar ao marcar concluído. NULL = legado (1 ponto). 0 = não somar.';

CREATE OR REPLACE FUNCTION public.trg_appointments_loyalty_after_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  phone_key text;
  pts integer;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM 'completed' THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;
  IF coalesce(NEW.is_subscriber, false) = true THEN
    RETURN NEW;
  END IF;

  phone_key := public.loyalty_whatsapp_storage_key(NEW.client_whatsapp);
  IF phone_key = '' THEN
    RETURN NEW;
  END IF;

  IF coalesce(NEW.is_loyalty_reward, false) = true THEN
    UPDATE public.establishment_client_loyalty
    SET cycle_progress = 0,
        updated_at = now()
    WHERE establishment_id = NEW.establishment_id
      AND client_whatsapp = phone_key;
    RETURN NEW;
  END IF;

  -- NULL no agendamento = legado (1 ponto). Valor explícito 0 = não somar (ex.: serviços com 0 pts).
  IF NEW.loyalty_points_awarded IS NULL THEN
    pts := 1;
  ELSE
    pts := GREATEST(0, NEW.loyalty_points_awarded);
  END IF;

  UPDATE public.establishment_client_loyalty ecl
  SET
    cycle_progress = LEAST(
      ecl.cycle_goal,
      ecl.cycle_progress + pts
    ),
    updated_at = now()
  WHERE ecl.establishment_id = NEW.establishment_id
    AND ecl.client_whatsapp = phone_key
    AND ecl.cycle_goal IS NOT NULL
    AND ecl.cycle_goal >= 2
    AND ecl.cycle_progress < ecl.cycle_goal;

  RETURN NEW;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
