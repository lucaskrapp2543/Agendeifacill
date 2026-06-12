-- Fase 2: cupom de parceiro no checkout Diamante + vínculo após conversão.

BEGIN;

ALTER TABLE public.site_registration_checkouts
  ADD COLUMN IF NOT EXISTS partner_referral_code text,
  ADD COLUMN IF NOT EXISTS partner_establishment_id uuid REFERENCES public.establishments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS original_amount_cents integer,
  ADD COLUMN IF NOT EXISTS discount_percent integer,
  ADD COLUMN IF NOT EXISTS final_amount_cents integer;

COMMENT ON COLUMN public.site_registration_checkouts.partner_referral_code IS
  'Cupom de parceiro usado no cadastro Diamante (Fase 2).';
COMMENT ON COLUMN public.site_registration_checkouts.original_amount_cents IS
  'Valor cheio do plano antes do desconto de indicação.';
COMMENT ON COLUMN public.site_registration_checkouts.final_amount_cents IS
  'Valor cobrado na primeira mensalidade com cupom válido.';

CREATE INDEX IF NOT EXISTS idx_site_registration_checkouts_partner_code
  ON public.site_registration_checkouts (partner_referral_code)
  WHERE partner_referral_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_site_registration_checkouts_partner_establishment
  ON public.site_registration_checkouts (partner_establishment_id)
  WHERE partner_establishment_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.partner_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  referred_establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  referral_code text NOT NULL,
  selected_plan text NOT NULL DEFAULT 'diamante' CHECK (selected_plan = 'diamante'),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'cancelled')),
  linked_at timestamptz,
  first_payment_id text,
  site_registration_checkout_id uuid REFERENCES public.site_registration_checkouts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT partner_referrals_referred_unique UNIQUE (referred_establishment_id),
  CONSTRAINT partner_referrals_not_self CHECK (partner_establishment_id <> referred_establishment_id)
);

CREATE INDEX IF NOT EXISTS idx_partner_referrals_partner_establishment
  ON public.partner_referrals (partner_establishment_id);

CREATE INDEX IF NOT EXISTS idx_partner_referrals_checkout
  ON public.partner_referrals (site_registration_checkout_id)
  WHERE site_registration_checkout_id IS NOT NULL;

COMMENT ON TABLE public.partner_referrals IS
  'Vínculo de indicação criado após pagamento aprovado do plano Diamante (Fase 2).';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_partner_referrals_updated_at'
  ) THEN
    CREATE TRIGGER trg_partner_referrals_updated_at
    BEFORE UPDATE ON public.partner_referrals
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

ALTER TABLE public.partner_referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partners can read own partner referrals" ON public.partner_referrals;
CREATE POLICY "Partners can read own partner referrals"
  ON public.partner_referrals
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.establishments e
      WHERE e.id = partner_referrals.partner_establishment_id
        AND e.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admin can read all partner referrals" ON public.partner_referrals;
CREATE POLICY "Admin can read all partner referrals"
  ON public.partner_referrals
  FOR SELECT
  TO authenticated
  USING (public.is_admin_user());

GRANT SELECT ON public.partner_referrals TO authenticated;
GRANT ALL ON public.partner_referrals TO service_role;

COMMIT;
