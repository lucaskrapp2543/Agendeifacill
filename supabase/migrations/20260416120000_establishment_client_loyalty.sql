-- Programa de fidelidade (clientes não assinantes): meta por cliente, progresso no ciclo atual,
-- agendamento gratuito marcado com is_loyalty_reward; trigger atualiza progresso ao concluir.

BEGIN;

-- Mesma ideia de EstablishmentDashboard.normalizeWhatsappForStorage (chave única por telefone).
CREATE OR REPLACE FUNCTION public.loyalty_whatsapp_storage_key(p_raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  digits text := regexp_replace(coalesce(p_raw, ''), '\D', '', 'g');
BEGIN
  IF digits = '' THEN
    RETURN '';
  END IF;
  IF digits ~ '^55' AND length(digits) IN (12, 13) THEN
    RETURN digits;
  END IF;
  IF length(digits) >= 10 AND length(digits) <= 11 THEN
    RETURN '55' || digits;
  END IF;
  RETURN digits;
END;
$$;

CREATE TABLE IF NOT EXISTS public.establishment_client_loyalty (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  client_whatsapp text NOT NULL,
  cycle_goal integer,
  cycle_progress integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT establishment_client_loyalty_goal_check CHECK (cycle_goal IS NULL OR cycle_goal >= 2),
  CONSTRAINT establishment_client_loyalty_progress_check CHECK (cycle_progress >= 0),
  UNIQUE (establishment_id, client_whatsapp)
);

CREATE INDEX IF NOT EXISTS establishment_client_loyalty_est_whatsapp_idx
  ON public.establishment_client_loyalty (establishment_id, client_whatsapp);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_establishment_client_loyalty_updated_at') THEN
    CREATE TRIGGER trg_establishment_client_loyalty_updated_at
    BEFORE UPDATE ON public.establishment_client_loyalty
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END$$;

ALTER TABLE public.establishment_client_loyalty ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner can view establishment client loyalty" ON public.establishment_client_loyalty;
CREATE POLICY "Owner can view establishment client loyalty"
  ON public.establishment_client_loyalty
  FOR SELECT
  USING (public.is_owner_of_establishment(establishment_id));

DROP POLICY IF EXISTS "Owner can insert establishment client loyalty" ON public.establishment_client_loyalty;
CREATE POLICY "Owner can insert establishment client loyalty"
  ON public.establishment_client_loyalty
  FOR INSERT
  WITH CHECK (public.is_owner_of_establishment(establishment_id));

DROP POLICY IF EXISTS "Owner can update establishment client loyalty" ON public.establishment_client_loyalty;
CREATE POLICY "Owner can update establishment client loyalty"
  ON public.establishment_client_loyalty
  FOR UPDATE
  USING (public.is_owner_of_establishment(establishment_id))
  WITH CHECK (public.is_owner_of_establishment(establishment_id));

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS is_loyalty_reward boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.appointments.is_loyalty_reward IS 'Serviço gratuito via programa de fidelidade (ciclo resgatado pelo cliente não assinante).';

CREATE OR REPLACE FUNCTION public.trg_appointments_loyalty_after_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  phone_key text;
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

  UPDATE public.establishment_client_loyalty ecl
  SET
    cycle_progress = ecl.cycle_progress + 1,
    updated_at = now()
  WHERE ecl.establishment_id = NEW.establishment_id
    AND ecl.client_whatsapp = phone_key
    AND ecl.cycle_goal IS NOT NULL
    AND ecl.cycle_goal >= 2
    AND ecl.cycle_progress < ecl.cycle_goal;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_appointments_loyalty_after_completed ON public.appointments;
CREATE TRIGGER trg_appointments_loyalty_after_completed
  AFTER UPDATE ON public.appointments
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed')
  EXECUTE FUNCTION public.trg_appointments_loyalty_after_completed();

COMMIT;

NOTIFY pgrst, 'reload schema';
