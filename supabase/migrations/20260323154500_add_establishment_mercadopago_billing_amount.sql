BEGIN;

ALTER TABLE public.establishments
ADD COLUMN IF NOT EXISTS mercadopago_billing_amount NUMERIC(10,2) DEFAULT NULL;

COMMENT ON COLUMN public.establishments.mercadopago_billing_amount
IS 'Valor da cobranca PIX de regularizacao especifico por estabelecimento (R$).';

COMMIT;
