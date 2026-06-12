-- Fase 8: dados Pix do parceiro para saque manual (Indique e Ganhe).
-- Somente cadastro — sem pagamento automático, MP ou billing.
-- Rode ANTES: 20260618120000_partner_payout_settings_VERIFY.sql

BEGIN;

-- ---------------------------------------------------------------------------
-- 0) Preflight
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_missing text := '';
  v_existing text := '';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'establishments'
  ) THEN
    v_missing := v_missing || ' establishments';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'establishments' AND column_name = 'id'
  ) THEN
    v_missing := v_missing || ' establishments.id';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'establishments' AND column_name = 'owner_id'
  ) THEN
    v_missing := v_missing || ' establishments.owner_id';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_admin_user'
  ) THEN
    v_missing := v_missing || ' is_admin_user()';
  END IF;

  IF v_missing <> '' THEN
    RAISE EXCEPTION 'Migration Fase 8 abortada. Dependências faltando:%', v_missing;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'partner_payout_settings'
  ) THEN
    v_existing := v_existing || ' partner_payout_settings';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_partner_payout_settings'
  ) THEN
    v_existing := v_existing || ' get_partner_payout_settings()';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'upsert_partner_payout_settings'
  ) THEN
    v_existing := v_existing || ' upsert_partner_payout_settings()';
  END IF;

  IF v_existing <> '' THEN
    RAISE NOTICE 'Fase 8: objetos já existentes (re-execução segura):%', v_existing;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 1) Tabela isolada (1 config por estabelecimento)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partner_payout_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  pix_key_type text NOT NULL CHECK (pix_key_type IN ('cpf_cnpj', 'phone', 'email', 'random')),
  pix_key text NOT NULL CHECK (char_length(trim(pix_key)) > 0),
  receiver_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT partner_payout_settings_establishment_unique UNIQUE (establishment_id)
);

CREATE INDEX IF NOT EXISTS idx_partner_payout_settings_establishment
  ON public.partner_payout_settings (establishment_id);

COMMENT ON TABLE public.partner_payout_settings IS
  'Chave Pix do parceiro para saques manuais do Indique e Ganhe. Não integra MP/billing.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_partner_payout_settings_updated_at'
  ) THEN
    CREATE TRIGGER trg_partner_payout_settings_updated_at
    BEFORE UPDATE ON public.partner_payout_settings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

ALTER TABLE public.partner_payout_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partners can read own payout settings" ON public.partner_payout_settings;
CREATE POLICY "Partners can read own payout settings"
  ON public.partner_payout_settings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.establishments e
      WHERE e.id = partner_payout_settings.establishment_id
        AND e.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admin can read all partner payout settings" ON public.partner_payout_settings;
CREATE POLICY "Admin can read all partner payout settings"
  ON public.partner_payout_settings
  FOR SELECT TO authenticated
  USING (public.is_admin_user());

GRANT SELECT ON public.partner_payout_settings TO authenticated;
GRANT ALL ON public.partner_payout_settings TO service_role;

-- ---------------------------------------------------------------------------
-- 2) RPCs (escrita só via upsert — parceiro dono ou admin)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_partner_payout_settings(p_establishment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_row public.partner_payout_settings%ROWTYPE;
BEGIN
  IF p_establishment_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_establishment_id');
  END IF;

  SELECT e.owner_id INTO v_owner_id
  FROM public.establishments e
  WHERE e.id = p_establishment_id;

  IF NOT public.is_admin_user() AND (v_owner_id IS NULL OR v_owner_id <> auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT * INTO v_row
  FROM public.partner_payout_settings
  WHERE establishment_id = p_establishment_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'settings', null);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'settings', jsonb_build_object(
      'id', v_row.id,
      'establishment_id', v_row.establishment_id,
      'pix_key_type', v_row.pix_key_type,
      'pix_key', v_row.pix_key,
      'receiver_name', v_row.receiver_name,
      'updated_at', v_row.updated_at
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_partner_payout_settings(
  p_establishment_id uuid,
  p_pix_key_type text,
  p_pix_key text,
  p_receiver_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_type text := lower(trim(coalesce(p_pix_key_type, '')));
  v_key text := trim(coalesce(p_pix_key, ''));
  v_name text := nullif(trim(coalesce(p_receiver_name, '')), '');
  v_row public.partner_payout_settings%ROWTYPE;
BEGIN
  IF p_establishment_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_establishment_id');
  END IF;

  SELECT e.owner_id INTO v_owner_id
  FROM public.establishments e
  WHERE e.id = p_establishment_id;

  IF NOT public.is_admin_user() AND (v_owner_id IS NULL OR v_owner_id <> auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF v_type NOT IN ('cpf_cnpj', 'phone', 'email', 'random') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_pix_key_type');
  END IF;

  IF v_key = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'empty_pix_key', 'message', 'Informe a chave Pix.');
  END IF;

  IF char_length(v_key) > 200 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'pix_key_too_long');
  END IF;

  INSERT INTO public.partner_payout_settings (
    establishment_id, pix_key_type, pix_key, receiver_name
  )
  VALUES (p_establishment_id, v_type, v_key, v_name)
  ON CONFLICT (establishment_id)
  DO UPDATE SET
    pix_key_type = EXCLUDED.pix_key_type,
    pix_key = EXCLUDED.pix_key,
    receiver_name = EXCLUDED.receiver_name,
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'ok', true,
    'settings', jsonb_build_object(
      'id', v_row.id,
      'establishment_id', v_row.establishment_id,
      'pix_key_type', v_row.pix_key_type,
      'pix_key', v_row.pix_key,
      'receiver_name', v_row.receiver_name,
      'updated_at', v_row.updated_at
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_partner_payout_settings(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_partner_payout_settings(uuid, text, text, text) TO authenticated;

COMMIT;
