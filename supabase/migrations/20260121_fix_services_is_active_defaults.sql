-- Corrigir serviços/categorias que podem ter sido criados sem is_active=true
-- Motivo: Booking e Dashboard filtram por is_active=true, então registros NULL/false "somem".

BEGIN;

-- Garantir default true (se a coluna existir)
ALTER TABLE IF EXISTS public.service_categories
  ALTER COLUMN is_active SET DEFAULT true;

ALTER TABLE IF EXISTS public.service_subcategories
  ALTER COLUMN is_active SET DEFAULT true;

-- Backfill: qualquer NULL vira true (não mexe em quem está explicitamente false)
UPDATE public.service_categories
SET is_active = true
WHERE is_active IS NULL;

UPDATE public.service_subcategories
SET is_active = true
WHERE is_active IS NULL;

COMMIT;

