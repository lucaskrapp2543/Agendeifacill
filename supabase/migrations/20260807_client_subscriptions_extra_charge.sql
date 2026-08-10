-- ============================================================================
-- VALOR EXTRA POR ASSINANTE (Meus Assinantes → Editar Assinante)
-- ----------------------------------------------------------------------------
-- Permite o barbeiro somar um valor fixo à assinatura de UM cliente específico,
-- com um nome que explica a cobrança (ex.: "serviço x a mais"). Ex.: plano de
-- R$ 16,00 + extra de R$ 10,00 = R$ 26,00 cobrados na renovação.
--
-- Regras acordadas com o usuário (06/08/2026):
--   * o extra vale até o barbeiro retirar (não é cobrança única);
--   * a comissão do profissional incide sobre o total (16+10), como se a
--     assinatura daquele cliente tivesse subido de valor;
--   * é por assinante — não é configuração global do plano.
--
-- Diferente de `custom_subscription_value` (que SUBSTITUI o valor do plano, usado
-- pelo botão "Alterar Valor"): aqui o valor SOMA e fica discriminado na tela.
-- Os dois podem coexistir: valor efetivo = (custom ?? valor do plano) + extra.
--
-- Aditivo e reversível: só ADICIONA duas colunas, ambas opcionais. Assinantes
-- existentes ficam NULL = exatamente o comportamento de hoje.
-- ============================================================================

BEGIN;

ALTER TABLE public.client_subscriptions
  ADD COLUMN IF NOT EXISTS extra_charge_value numeric(10,2),
  ADD COLUMN IF NOT EXISTS extra_charge_label text;

-- Extra negativo não faz sentido (para desconto existe o "Alterar Valor").
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'client_subscriptions_extra_charge_value_nonnegative'
  ) THEN
    ALTER TABLE public.client_subscriptions
      ADD CONSTRAINT client_subscriptions_extra_charge_value_nonnegative
      CHECK (extra_charge_value IS NULL OR extra_charge_value >= 0);
  END IF;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- ROLLBACK:
-- ALTER TABLE public.client_subscriptions
--   DROP COLUMN IF EXISTS extra_charge_value,
--   DROP COLUMN IF EXISTS extra_charge_label;
-- NOTIFY pgrst, 'reload schema';
-- ============================================================================
