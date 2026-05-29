BEGIN;

-- Helper: conta ADMIN/SUPORTE (mesmo padrão usado no projeto).
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) = 'suporteagendeifacil@gmail.com'
$$;

CREATE TABLE IF NOT EXISTS public.admin_mp_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  source_key text NOT NULL UNIQUE,
  source_type text NOT NULL CHECK (source_type IN ('appointment', 'subscription')),
  source_id text NULL,
  payment_id text NULL,
  external_reference text NULL,
  payment_method text NOT NULL DEFAULT 'pix' CHECK (payment_method IN ('pix', 'credito')),
  gross_amount_cents integer NULL CHECK (gross_amount_cents IS NULL OR gross_amount_cents >= 0),
  commission_cents integer NOT NULL DEFAULT 100 CHECK (commission_cents >= 0),
  status text NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'cancelled', 'refunded')),
  paid_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.admin_mp_commissions IS
'Ledger idempotente do R$1 do admin por pagamento Mercado Pago de clientes (agendamento/assinatura).';

CREATE INDEX IF NOT EXISTS idx_admin_mp_commissions_paid_at
  ON public.admin_mp_commissions (paid_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_mp_commissions_establishment_paid_at
  ON public.admin_mp_commissions (establishment_id, paid_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_mp_commissions_source_type
  ON public.admin_mp_commissions (source_type);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_admin_mp_commissions_updated_at ON public.admin_mp_commissions;
CREATE TRIGGER set_admin_mp_commissions_updated_at
BEFORE UPDATE ON public.admin_mp_commissions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.admin_mp_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can view admin_mp_commissions" ON public.admin_mp_commissions;
CREATE POLICY "Admin can view admin_mp_commissions"
  ON public.admin_mp_commissions
  FOR SELECT
  TO authenticated
  USING (public.is_admin_user());

DROP POLICY IF EXISTS "Admin can manage admin_mp_commissions" ON public.admin_mp_commissions;
CREATE POLICY "Admin can manage admin_mp_commissions"
  ON public.admin_mp_commissions
  FOR ALL
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

GRANT SELECT ON public.admin_mp_commissions TO authenticated;
GRANT ALL ON public.admin_mp_commissions TO service_role;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_mp_commissions;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

-- Backfill seguro do histórico já existente, sem duplicar quando o webhook chegar depois.
DO $$
BEGIN
  BEGIN
    EXECUTE $sql$
      INSERT INTO public.admin_mp_commissions (
        establishment_id,
        source_key,
        source_type,
        source_id,
        payment_id,
        payment_method,
        commission_cents,
        status,
        paid_at,
        metadata
      )
      SELECT
        a.establishment_id,
        'appointment:payment:' || a.payment_transaction_id::text,
        'appointment',
        a.id::text,
        a.payment_transaction_id::text,
        CASE
          WHEN lower(coalesce(a.payment_method::text, '')) LIKE '%pix%'
            OR lower(coalesce(a.pix_payment_status::text, '')) IN ('confirmado', 'aprovado')
          THEN 'pix'
          ELSE 'credito'
        END,
        100,
        'paid',
        coalesce(a.created_at, now()),
        jsonb_build_object('origin', 'migration_backfill_appointments')
      FROM public.appointments a
      WHERE a.establishment_id IS NOT NULL
        AND coalesce(a.payment_transaction_id::text, '') ~ '^[0-9]+$'
        AND (
          lower(coalesce(a.payment_status::text, '')) = 'paid'
          OR lower(coalesce(a.pix_payment_status::text, '')) IN ('confirmado', 'aprovado')
        )
      ON CONFLICT (source_key) DO NOTHING
    $sql$;
  EXCEPTION
    WHEN undefined_table OR undefined_column THEN NULL;
  END;

  BEGIN
    EXECUTE $sql$
      INSERT INTO public.admin_mp_commissions (
        establishment_id,
        source_key,
        source_type,
        source_id,
        payment_id,
        payment_method,
        commission_cents,
        status,
        paid_at,
        metadata
      )
      SELECT
        cs.establishment_id,
        'subscription:payment:' || cs.subscription_payment_order_id::text,
        'subscription',
        cs.id::text,
        cs.subscription_payment_order_id::text,
        CASE
          WHEN lower(coalesce(cs.subscriber_payment_method::text, '')) LIKE '%pix%'
            OR lower(coalesce(cs.subscription_payment_provider::text, '')) LIKE '%pix%'
          THEN 'pix'
          ELSE 'credito'
        END,
        100,
        'paid',
        coalesce(nullif(cs.last_payment_date::text, '')::timestamptz, cs.created_at, now()),
        jsonb_build_object('origin', 'migration_backfill_subscriptions')
      FROM public.client_subscriptions cs
      WHERE cs.establishment_id IS NOT NULL
        AND lower(coalesce(cs.payment_status::text, '')) = 'paid'
        AND lower(coalesce(cs.subscription_payment_provider::text, '')) LIKE 'mercadopago%'
        AND coalesce(cs.subscription_payment_order_id::text, '') <> ''
      ON CONFLICT (source_key) DO NOTHING
    $sql$;
  EXCEPTION
    WHEN undefined_table OR undefined_column THEN NULL;
  END;
END $$;

COMMIT;
