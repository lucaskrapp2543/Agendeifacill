-- Links globais do admin para cobrança (ex: Plano Ouro/Diamante)
-- Persistente entre PCs/celulares (salvo no Supabase)

BEGIN;

-- Helper: conta ADMIN/SUPORTE (padrão usado no projeto)
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) = 'suporteagendeifacil@gmail.com'
$$;

CREATE TABLE IF NOT EXISTS public.admin_billing_links (
  id TEXT PRIMARY KEY,
  ouro_link TEXT DEFAULT NULL,
  diamante_link TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.admin_billing_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can manage admin_billing_links" ON public.admin_billing_links;
CREATE POLICY "Admin can manage admin_billing_links"
  ON public.admin_billing_links
  FOR ALL
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

GRANT ALL ON public.admin_billing_links TO authenticated;
GRANT ALL ON public.admin_billing_links TO service_role;

COMMIT;

