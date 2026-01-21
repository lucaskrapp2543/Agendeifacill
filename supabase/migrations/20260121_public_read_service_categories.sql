-- Permitir que o booking público (anon) consiga ler serviços do sistema novo (categorias/subcategorias)
-- Sem isso, o app cai no legado (establishments.services_with_prices) e serviços recém-criados podem não aparecer.

BEGIN;

-- Garantir que as roles do Supabase tenham permissão de SELECT (RLS ainda controla as linhas)
GRANT SELECT ON TABLE public.service_categories TO anon, authenticated;
GRANT SELECT ON TABLE public.service_subcategories TO anon, authenticated;

-- Ativar RLS (caso já esteja ativado, é idempotente)
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_subcategories ENABLE ROW LEVEL SECURITY;

-- Policies públicas: leitura apenas do que estiver ativo
DROP POLICY IF EXISTS "Public can view active service categories" ON public.service_categories;
CREATE POLICY "Public can view active service categories"
ON public.service_categories
FOR SELECT
USING (is_active = true);

DROP POLICY IF EXISTS "Public can view active service subcategories" ON public.service_subcategories;
CREATE POLICY "Public can view active service subcategories"
ON public.service_subcategories
FOR SELECT
USING (is_active = true);

COMMIT;

