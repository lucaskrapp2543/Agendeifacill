-- Contador de cobranças manuais por assinante (Meus Assinantes)
-- Mantém histórico simples de quantas vezes o botão "Enviar cobrança" foi acionado.

ALTER TABLE public.client_subscriptions
  ADD COLUMN IF NOT EXISTS billing_reminder_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.client_subscriptions
  ADD COLUMN IF NOT EXISTS last_billing_reminder_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'client_subscriptions_billing_reminder_count_non_negative_chk'
  ) THEN
    ALTER TABLE public.client_subscriptions
      ADD CONSTRAINT client_subscriptions_billing_reminder_count_non_negative_chk
      CHECK (billing_reminder_count >= 0);
  END IF;
END $$;
