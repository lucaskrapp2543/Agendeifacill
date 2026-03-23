BEGIN;

CREATE TABLE IF NOT EXISTS public.establishment_billing_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  preapproval_id text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  payer_email text,
  amount_cents integer NOT NULL,
  description text,
  init_point text,
  payment_provider text NOT NULL DEFAULT 'mercadopago',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_charged_payment_id text,
  last_charged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  canceled_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_establishment_billing_subscriptions_establishment_id
  ON public.establishment_billing_subscriptions(establishment_id);

CREATE INDEX IF NOT EXISTS idx_establishment_billing_subscriptions_status
  ON public.establishment_billing_subscriptions(status);

ALTER TABLE public.establishment_billing_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'establishment_billing_subscriptions'
      AND policyname = 'Owners can read own billing subscriptions'
  ) THEN
    CREATE POLICY "Owners can read own billing subscriptions"
      ON public.establishment_billing_subscriptions
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.establishments e
          WHERE e.id = establishment_billing_subscriptions.establishment_id
            AND e.owner_id = auth.uid()
        )
      );
  END IF;
END $$;

COMMIT;

