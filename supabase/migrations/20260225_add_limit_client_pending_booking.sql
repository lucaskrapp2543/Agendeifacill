-- Limita novos agendamentos por telefone quando houver atendimento pendente.
-- Compatível com bases antigas (adiciona apenas se a coluna não existir).

ALTER TABLE public.establishments
ADD COLUMN IF NOT EXISTS limit_client_pending_booking boolean NOT NULL DEFAULT false;
