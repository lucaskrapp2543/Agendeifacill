-- Controle por assinatura: habilitar/desabilitar PIX e Cartão.
-- Seguro para executar mais de uma vez.

ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS payment_pix_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS payment_card_enabled BOOLEAN NOT NULL DEFAULT true;

-- Garantir consistência: sempre ao menos um método ativo.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'subscriptions_at_least_one_payment_method_chk'
      AND conrelid = 'public.subscriptions'::regclass
  ) THEN
    ALTER TABLE public.subscriptions
    ADD CONSTRAINT subscriptions_at_least_one_payment_method_chk
    CHECK (payment_pix_enabled OR payment_card_enabled);
  END IF;
END $$;

COMMENT ON COLUMN public.subscriptions.payment_pix_enabled
IS 'Quando true, permite pagamento por PIX para esta assinatura.';

COMMENT ON COLUMN public.subscriptions.payment_card_enabled
IS 'Quando true, permite pagamento por cartão para esta assinatura.';
