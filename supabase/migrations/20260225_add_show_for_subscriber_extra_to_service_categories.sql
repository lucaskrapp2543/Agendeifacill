-- Permite marcar categorias visíveis como "extra" no booking de assinante.
-- Compatível com bases antigas.
ALTER TABLE IF EXISTS public.service_categories
ADD COLUMN IF NOT EXISTS show_for_subscriber_extra boolean NOT NULL DEFAULT false;

