-- Adicionar coluna credit_card_link na tabela subscriptions
-- Esta coluna permite configurar um link externo de pagamento no cartão de crédito
-- (ex: Mercado Pago, PagSeguro etc) para o fluxo manual de assinatura.

ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS credit_card_link TEXT;

COMMENT ON COLUMN public.subscriptions.credit_card_link IS
  'Link externo para pagamento no cartão de crédito (fluxo manual). Sem integração automática: o cliente paga fora e depois clica em "Paguei" para registrar como pendente.';

