-- Permite ao dono do estabelecimento editar/remover registros
-- no financeiro da fila (waitlist_financial_logs).

BEGIN;

ALTER TABLE public.waitlist_financial_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner can update waitlist financial logs" ON public.waitlist_financial_logs;
CREATE POLICY "Owner can update waitlist financial logs"
  ON public.waitlist_financial_logs
  FOR UPDATE
  USING (public.is_owner_of_establishment(establishment_id))
  WITH CHECK (public.is_owner_of_establishment(establishment_id));

DROP POLICY IF EXISTS "Owner can delete waitlist financial logs" ON public.waitlist_financial_logs;
CREATE POLICY "Owner can delete waitlist financial logs"
  ON public.waitlist_financial_logs
  FOR DELETE
  USING (public.is_owner_of_establishment(establishment_id));

COMMIT;

NOTIFY pgrst, 'reload schema';

