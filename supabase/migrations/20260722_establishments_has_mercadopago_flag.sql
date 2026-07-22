-- ============================================================================
-- FASE 1 (do conserto do vazamento de establishments) — "plaquinha" has_mercadopago
-- ----------------------------------------------------------------------------
-- Cria uma coluna calculada que diz apenas SE o estabelecimento tem Mercado Pago
-- conectado (true/false), SEM expor o token. O site usa o token hoje só pra essa
-- verificação — então depois ele passa a olhar esta plaquinha, e o token de
-- verdade pode ser escondido (Fase 3).
--
-- IMPORTANTE: aditivo. Só ADICIONA uma coluna calculada. Não altera dados, não
-- remove nada, não mexe em token nem em pagamento. Reversível com DROP COLUMN.
-- ============================================================================

BEGIN;

ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS has_mercadopago boolean
  GENERATED ALWAYS AS (
    mercadopago_access_token IS NOT NULL
    AND btrim(mercadopago_access_token) <> ''
  ) STORED;

-- Garante que a plaquinha continue legível por todos, inclusive depois da Fase 3
GRANT SELECT (has_mercadopago) ON public.establishments TO anon, authenticated;

COMMIT;

-- ROLLBACK:
-- ALTER TABLE public.establishments DROP COLUMN IF EXISTS has_mercadopago;
