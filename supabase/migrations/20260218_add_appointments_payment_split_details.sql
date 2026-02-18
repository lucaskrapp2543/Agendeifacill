-- Multi forma de pagamento por agendamento (compatível com fluxo antigo)
-- Fluxo antigo continua usando appointments.payment_method normalmente.
-- Novo fluxo salva detalhes em appointments.payment_split_details quando payment_method = 'multi'.

ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS payment_split_details jsonb;

