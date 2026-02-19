-- Bloqueio de categoria por profissional no booking
-- Se o profissional estiver nesta lista, nenhum serviço da categoria aparece para ele.
ALTER TABLE public.service_categories
ADD COLUMN IF NOT EXISTS excluded_professional_ids jsonb;

