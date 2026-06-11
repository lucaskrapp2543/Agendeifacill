-- Permite ao estabelecimento desativar o programa AFCoins para seus clientes (booking).
-- Default true: estabelecimentos antigos continuam com AFCoins ativo.

ALTER TABLE public.establishments
ADD COLUMN IF NOT EXISTS client_afcoins_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.establishments.client_afcoins_enabled IS
  'Se false, clientes deste estabelecimento não participam do programa AFCoins (sem popup, pontos ou incentivos no booking).';

-- Reforço server-side: não registra pontos se o estabelecimento desativou AFCoins para clientes.
CREATE OR REPLACE FUNCTION public.afcoin_register_booking_event(
  p_establishment_id uuid,
  p_appointment_id uuid,
  p_client_phone text,
  p_client_name text,
  p_rule text,
  p_payment_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mp_connected boolean := false;
  v_client_afcoins_enabled boolean := true;
  v_enabled boolean := true;
  v_settings record;
  v_rule text := lower(coalesce(trim(p_rule), ''));
  v_points integer := 0;
  v_phone text;
  v_is_online boolean := false;
  v_appointment_date date;
  v_program_start date := date '2026-06-08';
BEGIN
  IF p_establishment_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT
    (coalesce(trim(e.mercadopago_access_token), '') <> ''),
    coalesce(e.client_afcoins_enabled, true)
  INTO v_mp_connected, v_client_afcoins_enabled
  FROM public.establishments e
  WHERE e.id = p_establishment_id
  LIMIT 1;

  IF NOT coalesce(v_client_afcoins_enabled, true) THEN
    RETURN false;
  END IF;

  IF NOT coalesce(v_mp_connected, false) THEN
    RETURN false;
  END IF;

  SELECT
    coalesce(s.enabled, true) AS enabled,
    coalesce(s.points_name_phone, 5) AS points_name_phone,
    coalesce(s.points_booking_confirm, 10) AS points_booking_confirm,
    coalesce(s.points_online_bonus, 45) AS points_online_bonus
  INTO v_settings
  FROM public.afcoin_settings s
  WHERE s.establishment_id = p_establishment_id
  LIMIT 1;

  IF found THEN
    v_enabled := coalesce(v_settings.enabled, true);
  END IF;

  IF NOT v_enabled THEN
    RETURN false;
  END IF;

  v_phone := public.afcoin_normalize_phone(coalesce(p_client_phone, ''));
  IF coalesce(v_phone, '') = '' THEN
    RETURN false;
  END IF;

  IF p_appointment_id IS NOT NULL THEN
    SELECT a.appointment_date
      INTO v_appointment_date
    FROM public.appointments a
    WHERE a.id = p_appointment_id
    LIMIT 1;

    IF found AND v_appointment_date IS NOT NULL AND v_appointment_date < v_program_start THEN
      RETURN false;
    END IF;
  END IF;

  IF v_rule = 'name_phone_5' THEN
    v_points := coalesce(v_settings.points_name_phone, 5);
    v_is_online := false;
  ELSIF v_rule = 'booking_confirm_10' THEN
    v_points := coalesce(v_settings.points_booking_confirm, 10);
    v_is_online := false;
  ELSIF v_rule = 'local_bonus_3' THEN
    v_points := 3;
    v_is_online := false;
  ELSIF v_rule = 'local_total_18' THEN
    v_points := coalesce(v_settings.points_name_phone, 5)
      + coalesce(v_settings.points_booking_confirm, 10)
      + 3;
    v_is_online := false;
  ELSIF v_rule = 'local_total_10' THEN
    v_points := coalesce(v_settings.points_booking_confirm, 10);
    v_is_online := false;
  ELSIF v_rule = 'online_bonus_45' THEN
    v_points := coalesce(v_settings.points_online_bonus, 45);
    v_is_online := true;
  ELSIF v_rule = 'online_total_60' THEN
    v_points := coalesce(v_settings.points_name_phone, 5)
      + coalesce(v_settings.points_booking_confirm, 10)
      + coalesce(v_settings.points_online_bonus, 45);
    v_is_online := true;
  ELSE
    RETURN false;
  END IF;

  RETURN public.afcoin_add_transaction(
    p_establishment_id,
    v_phone,
    coalesce(p_client_name, 'Cliente'),
    p_appointment_id,
    p_payment_id,
    v_rule,
    v_points,
    v_is_online,
    coalesce(p_metadata, '{}'::jsonb)
  );
END;
$$;
