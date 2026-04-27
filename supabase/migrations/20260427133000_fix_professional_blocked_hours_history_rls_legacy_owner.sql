BEGIN;

-- Corrige RLS do histórico de bloqueio para cenários legados
-- onde o dono pode estar representado por owner_id = auth.uid()
-- ou, em bases antigas, establishments.id = auth.uid().

ALTER TABLE public.professional_blocked_hours_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can read blocked hours history" ON public.professional_blocked_hours_history;
CREATE POLICY "Owners can read blocked hours history"
  ON public.professional_blocked_hours_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.establishments e
      WHERE e.id = professional_blocked_hours_history.establishment_id
        AND (e.owner_id = auth.uid() OR e.id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Owners can insert blocked hours history" ON public.professional_blocked_hours_history;
CREATE POLICY "Owners can insert blocked hours history"
  ON public.professional_blocked_hours_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.establishments e
      WHERE e.id = professional_blocked_hours_history.establishment_id
        AND (e.owner_id = auth.uid() OR e.id = auth.uid())
    )
    AND (
      performed_by_user_id IS NULL
      OR performed_by_user_id = auth.uid()
    )
  );

-- Mantém grants explícitos para evitar regressão em bancos com privilégios alterados.
GRANT SELECT, INSERT ON public.professional_blocked_hours_history TO authenticated;
GRANT SELECT, INSERT ON public.professional_blocked_hours_history TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
