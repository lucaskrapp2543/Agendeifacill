-- Corrige RLS do client_subscriptions para permitir o estabelecimento inserir/gerenciar
-- seus próprios assinantes, evitando "new row violates row-level security policy".

BEGIN;

ALTER TABLE public.client_subscriptions ENABLE ROW LEVEL SECURITY;

-- Recriar policy principal dos estabelecimentos com USING + WITH CHECK (necessário para INSERT)
DROP POLICY IF EXISTS "Establishments can manage their client subscriptions" ON public.client_subscriptions;

CREATE POLICY "Establishments can manage their client subscriptions"
  ON public.client_subscriptions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.establishments e
      WHERE e.owner_id = auth.uid()
        AND e.id::text = public.client_subscriptions.establishment_id::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.establishments e
      WHERE e.owner_id = auth.uid()
        AND e.id::text = public.client_subscriptions.establishment_id::text
    )
  );

COMMIT;

