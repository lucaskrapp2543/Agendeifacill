-- Corrige RLS do manual_clients para permitir INSERT/UPDATE/DELETE do dono do estabelecimento.
-- A policy antiga tinha só USING (faltava WITH CHECK), o que pode bloquear INSERT.

BEGIN;

ALTER TABLE public.manual_clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Establishments can manage their own manual clients" ON public.manual_clients;

CREATE POLICY "Establishments can manage their own manual clients"
  ON public.manual_clients
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.establishments e
      WHERE e.owner_id = auth.uid()
        AND e.id::text = public.manual_clients.establishment_id::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.establishments e
      WHERE e.owner_id = auth.uid()
        AND e.id::text = public.manual_clients.establishment_id::text
    )
  );

COMMIT;

