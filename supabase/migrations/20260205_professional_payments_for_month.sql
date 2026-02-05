-- Pagamentos de profissionais: referência ao mês a que o pagamento se refere.
-- Assim, um pagamento feito em 04/02 (fev) pode ser "do mês de janeiro" e contar só em jan.
-- Formato: 'YYYY-MM' (ex: '2026-01'). NULL = compatibilidade: considerar pela payment_date.

ALTER TABLE public.professional_payments
  ADD COLUMN IF NOT EXISTS for_month text;

COMMENT ON COLUMN public.professional_payments.for_month IS 'Mês a que o pagamento se refere (YYYY-MM). Null = usar payment_date (comportamento antigo).';
