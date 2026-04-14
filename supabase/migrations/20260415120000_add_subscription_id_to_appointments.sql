-- Coluna opcional: qual plano (subscriptions.id) foi usado no agendamento de assinante.
-- Complementa subscriber_service_* (migration 20260218_add_subscription_divided_services.sql).
-- ADD COLUMN IF NOT EXISTS mantém DBs que já têm a coluna intactos.

ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_subscription_id ON public.appointments(subscription_id);

COMMENT ON COLUMN public.appointments.subscription_id IS 'Plano de assinatura associado ao agendamento quando is_subscriber = true.';
