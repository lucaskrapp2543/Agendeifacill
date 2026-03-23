BEGIN;

-- Valor global configurado no Admin para cobrança PIX da barbearia
ALTER TABLE public.admin_billing_links
ADD COLUMN IF NOT EXISTS mercadopago_billing_amount NUMERIC(10,2) DEFAULT 0;

COMMENT ON COLUMN public.admin_billing_links.mercadopago_billing_amount
IS 'Valor global (R$) usado para gerar PIX de regularizacao da barbearia no dashboard.';

-- Pagamentos PIX de regularizacao da barbearia (separado de appointments)
CREATE TABLE IF NOT EXISTS public.establishment_billing_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  payment_provider TEXT NOT NULL DEFAULT 'mercadopago',
  payment_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'refunded')),
  description TEXT,
  qr_code TEXT,
  qr_code_base64 TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_establishment_billing_payments_establishment
  ON public.establishment_billing_payments(establishment_id);

CREATE INDEX IF NOT EXISTS idx_establishment_billing_payments_status
  ON public.establishment_billing_payments(status);

CREATE INDEX IF NOT EXISTS idx_establishment_billing_payments_created_at
  ON public.establishment_billing_payments(created_at DESC);

ALTER TABLE public.establishment_billing_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner can read billing payments" ON public.establishment_billing_payments;
CREATE POLICY "Owner can read billing payments"
  ON public.establishment_billing_payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.establishments e
      WHERE e.id = establishment_billing_payments.establishment_id
        AND e.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owner can insert billing payments" ON public.establishment_billing_payments;
CREATE POLICY "Owner can insert billing payments"
  ON public.establishment_billing_payments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.establishments e
      WHERE e.id = establishment_billing_payments.establishment_id
        AND e.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owner can update billing payments" ON public.establishment_billing_payments;
CREATE POLICY "Owner can update billing payments"
  ON public.establishment_billing_payments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.establishments e
      WHERE e.id = establishment_billing_payments.establishment_id
        AND e.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.establishments e
      WHERE e.id = establishment_billing_payments.establishment_id
        AND e.owner_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.establishment_billing_payments TO authenticated;
GRANT ALL ON public.establishment_billing_payments TO service_role;

COMMIT;
