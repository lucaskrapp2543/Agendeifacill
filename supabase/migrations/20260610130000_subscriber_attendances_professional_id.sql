-- Vincula atendimento de assinatura ao profissional por ID (evita duplicar por variação de nome).
ALTER TABLE public.subscriber_attendances
  ADD COLUMN IF NOT EXISTS professional_id TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriber_attendances_professional_id
  ON public.subscriber_attendances(professional_id)
  WHERE professional_id IS NOT NULL;

COMMENT ON COLUMN public.subscriber_attendances.professional_id IS
  'ID do profissional no JSON establishments.professionals (agrupa financeiro mesmo se o nome mudar).';
