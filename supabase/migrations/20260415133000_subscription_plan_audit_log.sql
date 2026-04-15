-- Histórico de alterações em planos de assinatura (tabela subscriptions).
-- Grava data/hora com precisão (clock_timestamp), operação, snapshot e auth.uid() quando existir sessão.

CREATE TABLE IF NOT EXISTS public.subscription_plan_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  subscription_id uuid NULL,
  operation text NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  actor_user_id uuid NULL,
  old_row jsonb NULL,
  new_row jsonb NULL
);

CREATE INDEX IF NOT EXISTS idx_subscription_plan_audit_logs_est_sub_created
  ON public.subscription_plan_audit_logs (establishment_id, subscription_id, created_at DESC);

COMMENT ON TABLE public.subscription_plan_audit_logs IS 'Auditoria de INSERT/UPDATE/DELETE em public.subscriptions (planos oferecidos).';

ALTER TABLE public.subscription_plan_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Establishment owners can read subscription plan audit logs" ON public.subscription_plan_audit_logs;
CREATE POLICY "Establishment owners can read subscription plan audit logs"
  ON public.subscription_plan_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.establishments e
      WHERE e.id = subscription_plan_audit_logs.establishment_id
        AND e.owner_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.subscription_plan_audit_log_trigger_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
BEGIN
  v_actor := auth.uid();

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.subscription_plan_audit_logs (
      establishment_id, subscription_id, operation, actor_user_id, old_row, new_row
    ) VALUES (
      OLD.establishment_id,
      OLD.id,
      'DELETE',
      v_actor,
      to_jsonb(OLD),
      NULL
    );
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.subscription_plan_audit_logs (
      establishment_id, subscription_id, operation, actor_user_id, old_row, new_row
    ) VALUES (
      NEW.establishment_id,
      NEW.id,
      'UPDATE',
      v_actor,
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.subscription_plan_audit_logs (
      establishment_id, subscription_id, operation, actor_user_id, old_row, new_row
    ) VALUES (
      NEW.establishment_id,
      NEW.id,
      'INSERT',
      v_actor,
      NULL,
      to_jsonb(NEW)
    );
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS subscription_plan_audit_log_trigger ON public.subscriptions;
CREATE TRIGGER subscription_plan_audit_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.subscription_plan_audit_log_trigger_fn();

GRANT SELECT ON public.subscription_plan_audit_logs TO authenticated;
