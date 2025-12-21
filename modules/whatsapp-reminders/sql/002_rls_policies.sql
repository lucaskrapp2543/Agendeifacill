-- Módulo isolado: WhatsApp Reminders (WaSenderAPI)
-- 002 - Segurança (RLS + policies + triggers)
-- Objetivo: impedir exposição de `api_key_encrypted` no frontend.

BEGIN;

-- Helper: considerar "ADMIN" a conta de suporte (padrão já usado no projeto)
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT (auth.jwt() ->> 'email') = 'suporteagendeifacil@gmail.com'
$$;

-- Helper: estabelecimento dono (mesmo padrão usado em `manual_clients`)
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

-- updated_at trigger (isolado)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Triggers de updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_whatsapp_instances_updated_at') THEN
    CREATE TRIGGER trg_whatsapp_instances_updated_at
    BEFORE UPDATE ON public.whatsapp_instances
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_whatsapp_reminder_settings_updated_at') THEN
    CREATE TRIGGER trg_whatsapp_reminder_settings_updated_at
    BEFORE UPDATE ON public.whatsapp_reminder_settings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END$$;

-- Enable RLS
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_reminder_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_reminder_logs ENABLE ROW LEVEL SECURITY;

-- IMPORTANTE: bloquear leitura do campo sensível para anon/authenticated
-- (service_role continua tendo acesso via bypass de RLS e privilégios).
REVOKE SELECT (api_key_encrypted) ON public.whatsapp_instances FROM anon, authenticated;

-- Policies: whatsapp_instances
DROP POLICY IF EXISTS "Admin can manage whatsapp_instances" ON public.whatsapp_instances;
CREATE POLICY "Admin can manage whatsapp_instances"
  ON public.whatsapp_instances
  FOR ALL
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Establishments can view their whatsapp instance (no api key)" ON public.whatsapp_instances;
CREATE POLICY "Establishments can view their whatsapp instance (no api key)"
  ON public.whatsapp_instances
  FOR SELECT
  USING (public.is_owner_of_establishment(establishment_id));

-- Policies: whatsapp_reminder_settings
DROP POLICY IF EXISTS "Admin can manage whatsapp_reminder_settings" ON public.whatsapp_reminder_settings;
CREATE POLICY "Admin can manage whatsapp_reminder_settings"
  ON public.whatsapp_reminder_settings
  FOR ALL
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Establishments can view their whatsapp reminder settings" ON public.whatsapp_reminder_settings;
CREATE POLICY "Establishments can view their whatsapp reminder settings"
  ON public.whatsapp_reminder_settings
  FOR SELECT
  USING (public.is_owner_of_establishment(establishment_id));

-- Policies: whatsapp_reminder_logs (somente leitura por admin e dono)
DROP POLICY IF EXISTS "Admin can view whatsapp_reminder_logs" ON public.whatsapp_reminder_logs;
CREATE POLICY "Admin can view whatsapp_reminder_logs"
  ON public.whatsapp_reminder_logs
  FOR SELECT
  USING (public.is_admin_user());

DROP POLICY IF EXISTS "Establishments can view their whatsapp_reminder_logs" ON public.whatsapp_reminder_logs;
CREATE POLICY "Establishments can view their whatsapp_reminder_logs"
  ON public.whatsapp_reminder_logs
  FOR SELECT
  USING (public.is_owner_of_establishment(establishment_id));

COMMIT;


