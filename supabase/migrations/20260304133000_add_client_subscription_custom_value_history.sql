-- Valor personalizado pago pelo assinante + historico de alteracoes (max 10)
-- Objetivo: permitir desconto/ajuste por assinante sem alterar o valor base do plano.

ALTER TABLE public.client_subscriptions
ADD COLUMN IF NOT EXISTS custom_subscription_value numeric(10,2);

ALTER TABLE public.client_subscriptions
ADD COLUMN IF NOT EXISTS subscription_value_change_history jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'client_subscriptions_custom_subscription_value_nonnegative'
  ) THEN
    ALTER TABLE public.client_subscriptions
      ADD CONSTRAINT client_subscriptions_custom_subscription_value_nonnegative
      CHECK (custom_subscription_value IS NULL OR custom_subscription_value >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'client_subscriptions_value_change_history_array_check'
  ) THEN
    ALTER TABLE public.client_subscriptions
      ADD CONSTRAINT client_subscriptions_value_change_history_array_check
      CHECK (jsonb_typeof(subscription_value_change_history) = 'array');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'client_subscriptions_value_change_history_max10'
  ) THEN
    ALTER TABLE public.client_subscriptions
      ADD CONSTRAINT client_subscriptions_value_change_history_max10
      CHECK (jsonb_array_length(subscription_value_change_history) <= 10);
  END IF;
END $$;
