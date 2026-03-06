BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.professional_blocked_hours_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  professional_id text NOT NULL,
  professional_name text NULL,
  action_type text NOT NULL CHECK (action_type IN ('block', 'unblock')),
  block_date date NOT NULL,
  block_time text NOT NULL CHECK (block_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  source text NOT NULL DEFAULT 'manual',
  performed_by_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_blocked_hours_history_establishment_created
  ON public.professional_blocked_hours_history(establishment_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_blocked_hours_history_professional_created
  ON public.professional_blocked_hours_history(professional_id, created_at DESC);

ALTER TABLE public.professional_blocked_hours_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'professional_blocked_hours_history'
      AND policyname = 'Owners can read blocked hours history'
  ) THEN
    CREATE POLICY "Owners can read blocked hours history"
      ON public.professional_blocked_hours_history
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.establishments e
          WHERE e.id = professional_blocked_hours_history.establishment_id
            AND e.owner_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'professional_blocked_hours_history'
      AND policyname = 'Owners can insert blocked hours history'
  ) THEN
    CREATE POLICY "Owners can insert blocked hours history"
      ON public.professional_blocked_hours_history
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.establishments e
          WHERE e.id = professional_blocked_hours_history.establishment_id
            AND e.owner_id = auth.uid()
        )
        AND (
          performed_by_user_id IS NULL
          OR performed_by_user_id = auth.uid()
        )
      );
  END IF;
END $$;

GRANT SELECT, INSERT ON public.professional_blocked_hours_history TO authenticated;
GRANT SELECT, INSERT ON public.professional_blocked_hours_history TO service_role;

COMMIT;
