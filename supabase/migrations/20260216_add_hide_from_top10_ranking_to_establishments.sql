-- Permite que cada estabelecimento escolha se participa do TOP 10.
-- Migração segura: não remove nem renomeia nada existente.
ALTER TABLE public.establishments
ADD COLUMN IF NOT EXISTS hide_from_top10_ranking boolean;

UPDATE public.establishments
SET hide_from_top10_ranking = false
WHERE hide_from_top10_ranking IS NULL;

ALTER TABLE public.establishments
ALTER COLUMN hide_from_top10_ranking SET DEFAULT false;

ALTER TABLE public.establishments
ALTER COLUMN hide_from_top10_ranking SET NOT NULL;

COMMENT ON COLUMN public.establishments.hide_from_top10_ranking IS
'Se true, estabelecimento fica oculto no ranking TOP 10 global.';
