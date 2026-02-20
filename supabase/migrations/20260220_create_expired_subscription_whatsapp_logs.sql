-- Lembrete automatico de cobranca para assinaturas vencidas (WhatsApp)
-- Tabela isolada para controle anti-duplicidade por dia.

CREATE TABLE IF NOT EXISTS public.expired_subscription_whatsapp_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  client_subscription_id uuid NOT NULL REFERENCES public.client_subscriptions(id) ON DELETE CASCADE,
  phone_to text,
  message text NOT NULL,
  status text NOT NULL CHECK (status IN ('sent', 'failed')),
  provider_response text,
  sent_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_subscription_id, sent_date)
);

CREATE INDEX IF NOT EXISTS expired_subscription_whatsapp_logs_establishment_id_idx
  ON public.expired_subscription_whatsapp_logs (establishment_id);

CREATE INDEX IF NOT EXISTS expired_subscription_whatsapp_logs_sent_date_idx
  ON public.expired_subscription_whatsapp_logs (sent_date DESC);

