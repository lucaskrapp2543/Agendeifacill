-- Fila de Espera: histórico financeiro exclusivo (por profissional)
-- Observação: não mistura com agendamentos normais.

BEGIN;

CREATE TABLE IF NOT EXISTS public.waitlist_financial_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  professional_id TEXT NOT NULL,
  waitlist_entry_id UUID NULL REFERENCES public.waitlist_entries(id) ON DELETE SET NULL,
  appointment_id UUID NULL REFERENCES public.appointments(id) ON DELETE SET NULL,
  service_name TEXT NOT NULL,
  gross_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  professional_percentage NUMERIC(6,2) NOT NULL DEFAULT 100,
  professional_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (waitlist_entry_id)
);

CREATE INDEX IF NOT EXISTS waitlist_financial_logs_est_prof_time_idx
  ON public.waitlist_financial_logs (establishment_id, professional_id, occurred_at DESC);

-- Helper: dono do estabelecimento (recria caso não exista)
CREATE OR REPLACE FUNCTION public.is_owner_of_establishment(p_establishment_id uuid)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.establishments e
    WHERE e.id = p_establishment_id
      AND e.owner_id = auth.uid()
  )
$$;

ALTER TABLE public.waitlist_financial_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner can view waitlist financial logs" ON public.waitlist_financial_logs;
CREATE POLICY "Owner can view waitlist financial logs"
  ON public.waitlist_financial_logs
  FOR SELECT
  USING (public.is_owner_of_establishment(establishment_id));

DROP POLICY IF EXISTS "Owner can insert waitlist financial logs" ON public.waitlist_financial_logs;
CREATE POLICY "Owner can insert waitlist financial logs"
  ON public.waitlist_financial_logs
  FOR INSERT
  WITH CHECK (public.is_owner_of_establishment(establishment_id));

COMMIT;

NOTIFY pgrst, 'reload schema';

