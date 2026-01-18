-- Admin: adicionar link global do Plano PRATA (persistente no Supabase)

BEGIN;

ALTER TABLE public.admin_billing_links
ADD COLUMN IF NOT EXISTS prata_link TEXT DEFAULT NULL;

COMMIT;

NOTIFY pgrst, 'reload schema';

