-- Nova funcionalidade: "Dividir servicos" nas assinaturas
-- Mantem compatibilidade com o fluxo antigo:
-- - Se "divide_services_enabled" = false, sistema continua usando service_duration.
-- - Se true, usa "divided_services" para escolher o servico antes do profissional.

ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS divide_services_enabled boolean DEFAULT false;

ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS divided_services jsonb;

-- Persistir qual servico da assinatura foi escolhido no agendamento
-- (necessario para validar limite por servico sem afetar fluxo legado)
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS subscriber_service_id text;

ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS subscriber_service_name text;

ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS subscriber_service_limit integer;
