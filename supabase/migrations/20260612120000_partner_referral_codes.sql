-- Fase 1: cupom exclusivo do Programa de Parceiros (Indique e Ganhe).
-- Um cupom por estabelecimento; código único globalmente.

BEGIN;

CREATE TABLE IF NOT EXISTS public.partner_referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  code text NOT NULL CHECK (
    char_length(btrim(code)) >= 3
    AND char_length(code) <= 20
    AND code = upper(code)
    AND code ~ '^[A-Z0-9]+$'
  ),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT partner_referral_codes_establishment_unique UNIQUE (establishment_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS partner_referral_codes_code_lower_unique
  ON public.partner_referral_codes (lower(code));

CREATE INDEX IF NOT EXISTS partner_referral_codes_establishment_idx
  ON public.partner_referral_codes (establishment_id);

COMMENT ON TABLE public.partner_referral_codes IS
  'Cupom exclusivo do estabelecimento parceiro (Indique e Ganhe). Fase 1: apenas cadastro e compartilhamento.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_partner_referral_codes_updated_at'
  ) THEN
    CREATE TRIGGER trg_partner_referral_codes_updated_at
    BEFORE UPDATE ON public.partner_referral_codes
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

ALTER TABLE public.partner_referral_codes ENABLE ROW LEVEL SECURITY;

-- Dono lê o próprio cupom
DROP POLICY IF EXISTS "Owners can read own partner referral code" ON public.partner_referral_codes;
CREATE POLICY "Owners can read own partner referral code"
  ON public.partner_referral_codes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.establishments e
      WHERE e.id = partner_referral_codes.establishment_id
        AND e.owner_id = auth.uid()
    )
  );

-- Dono cria cupom uma vez (establishment_id deve ser dele)
DROP POLICY IF EXISTS "Owners can insert own partner referral code" ON public.partner_referral_codes;
CREATE POLICY "Owners can insert own partner referral code"
  ON public.partner_referral_codes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.establishments e
      WHERE e.id = partner_referral_codes.establishment_id
        AND e.owner_id = auth.uid()
    )
  );

-- Admin lê todos
DROP POLICY IF EXISTS "Admin can read all partner referral codes" ON public.partner_referral_codes;
CREATE POLICY "Admin can read all partner referral codes"
  ON public.partner_referral_codes
  FOR SELECT
  TO authenticated
  USING (public.is_admin_user());

GRANT SELECT, INSERT ON public.partner_referral_codes TO authenticated;
GRANT ALL ON public.partner_referral_codes TO service_role;

COMMIT;
