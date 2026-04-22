-- Fidelidade: evitar contagem duplicada por agendamento e impedir reset indevido.
-- Cenários cobertos:
-- 1) Alternar status (pending <-> completed) não pode somar novamente.
-- 2) is_loyalty_reward=true só pode zerar quando a meta já estiver atingida.
-- 3) Se vier reward inválido (meta não atingida), trata como atendimento normal.

BEGIN;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS loyalty_applied_at timestamptz;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS loyalty_applied_points integer;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS loyalty_applied_action text;

COMMENT ON COLUMN public.appointments.loyalty_applied_at IS
  'Timestamp da 1ª aplicação de fidelidade deste agendamento (idempotência).';

COMMENT ON COLUMN public.appointments.loyalty_applied_points IS
  'Quantidade de pontos aplicada na 1ª conclusão (0 quando reset por benefício).';

COMMENT ON COLUMN public.appointments.loyalty_applied_action IS
  'Ação aplicada na 1ª conclusão: increment ou reset.';

CREATE OR REPLACE FUNCTION public.trg_appointments_loyalty_after_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  phone_key text;
  pts integer;
  current_goal integer;
  current_progress integer;
  apply_action text;
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

  -- Idempotência: se já aplicou fidelidade para este agendamento uma vez, ignora.
  IF NEW.loyalty_applied_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  phone_key := public.loyalty_whatsapp_storage_key(NEW.client_whatsapp);
  IF phone_key = '' THEN
    RETURN NEW;
  END IF;

  SELECT ecl.cycle_goal, ecl.cycle_progress
    INTO current_goal, current_progress
  FROM public.establishment_client_loyalty ecl
  WHERE ecl.establishment_id = NEW.establishment_id
    AND ecl.client_whatsapp = phone_key
  FOR UPDATE;

  -- Sem programa configurado para o cliente: mantém comportamento legado (não soma).
  IF NOT FOUND OR current_goal IS NULL OR current_goal < 2 THEN
    RETURN NEW;
  END IF;

  IF coalesce(NEW.is_loyalty_reward, false) = true
     AND current_progress >= current_goal THEN
    UPDATE public.establishment_client_loyalty
    SET cycle_progress = 0,
        updated_at = now()
    WHERE establishment_id = NEW.establishment_id
      AND client_whatsapp = phone_key;

    pts := 0;
    apply_action := 'reset';
  ELSE
    -- Regra padrão:
    -- NULL = legado (1 ponto); valor explícito = max(0, valor).
    IF NEW.loyalty_points_awarded IS NULL THEN
      pts := 1;
    ELSE
      pts := GREATEST(0, NEW.loyalty_points_awarded);
    END IF;

    -- Guarda extra:
    -- Se veio "fidelidade" sem meta atingida (flag indevida), não zera.
    -- E, se veio 0/null por causa desse flag, trata como atendimento normal (1 ponto).
    IF coalesce(NEW.is_loyalty_reward, false) = true
       AND current_progress < current_goal
       AND coalesce(NEW.loyalty_points_awarded, 0) <= 0 THEN
      pts := 1;
    END IF;

    UPDATE public.establishment_client_loyalty ecl
    SET cycle_progress = LEAST(ecl.cycle_goal, ecl.cycle_progress + pts),
        updated_at = now()
    WHERE ecl.establishment_id = NEW.establishment_id
      AND ecl.client_whatsapp = phone_key
      AND ecl.cycle_goal IS NOT NULL
      AND ecl.cycle_goal >= 2
      AND ecl.cycle_progress < ecl.cycle_goal;

    apply_action := 'increment';
  END IF;

  -- Marca o agendamento como já aplicado para impedir dupla contagem futura.
  UPDATE public.appointments
  SET loyalty_applied_at = now(),
      loyalty_applied_points = pts,
      loyalty_applied_action = apply_action
  WHERE id = NEW.id
    AND loyalty_applied_at IS NULL;

  RETURN NEW;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
