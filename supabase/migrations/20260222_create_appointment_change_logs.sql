BEGIN;

CREATE TABLE IF NOT EXISTS public.appointment_change_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  changed_by_user_id UUID NULL,
  changed_by_name TEXT NULL,
  event_type TEXT NOT NULL,
  description TEXT NULL,
  old_values JSONB NULL,
  new_values JSONB NULL,
  metadata JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS appointment_change_logs_establishment_id_idx
  ON public.appointment_change_logs (establishment_id);

CREATE INDEX IF NOT EXISTS appointment_change_logs_appointment_id_idx
  ON public.appointment_change_logs (appointment_id);

CREATE INDEX IF NOT EXISTS appointment_change_logs_created_at_idx
  ON public.appointment_change_logs (created_at DESC);

ALTER TABLE public.appointment_change_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "appointment_change_logs_select_owner" ON public.appointment_change_logs;
CREATE POLICY "appointment_change_logs_select_owner"
  ON public.appointment_change_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.establishments e
      WHERE e.id = appointment_change_logs.establishment_id
        AND e.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "appointment_change_logs_insert_owner" ON public.appointment_change_logs;
CREATE POLICY "appointment_change_logs_insert_owner"
  ON public.appointment_change_logs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.establishments e
      WHERE e.id = appointment_change_logs.establishment_id
        AND e.owner_id = auth.uid()
    )
  );

COMMIT;
