-- =====================================================================
-- NOVAS BARBEARIAS JÁ NASCEM COM "ONLINE E NO LOCAL"
-- =====================================================================
--
-- PROBLEMA (visto em 30/09/2026 na barbearia de teste 3034)
--   A migration 20260929 ligou "Online e no local" em quem JÁ existia, mas as
--   colunas continuavam com DEFAULT false. Toda conta criada depois nascia com a
--   cobrança online desligada e o cliente não via "Pagar com PIX / cartão".
--
-- O QUE FAZ
--   1. Muda o padrão das duas colunas para true (novas contas = online e no local).
--   2. Liga em qualquer conta ativa que tenha sido criada com false nesse meio tempo.
--   Nada muda para quem já está com "apenas online" (obrigatório) ou já ligado.
--
-- RISCO: mínimo. Só altera o DEFAULT e linhas que estão desligadas. Reversível:
--   ALTER TABLE public.establishments ALTER COLUMN exigir_pagamento_antecipado_mercadopago SET DEFAULT false;
--   ALTER TABLE public.establishments ALTER COLUMN pagamento_adiantado_opcional_mercadopago SET DEFAULT false;
-- =====================================================================

BEGIN;

ALTER TABLE public.establishments
  ALTER COLUMN exigir_pagamento_antecipado_mercadopago SET DEFAULT true;
ALTER TABLE public.establishments
  ALTER COLUMN pagamento_adiantado_opcional_mercadopago SET DEFAULT true;

UPDATE public.establishments
SET exigir_pagamento_antecipado_mercadopago = true,
    pagamento_adiantado_opcional_mercadopago = true
WHERE coalesce(is_deleted, false) = false
  AND coalesce(exigir_pagamento_antecipado_mercadopago, false) = false;

-- Conferência: os dois defaults têm que aparecer como "true" e a contagem tem que ser 0
SELECT
  (SELECT column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'establishments' AND column_name = 'exigir_pagamento_antecipado_mercadopago') AS default_exigir,
  (SELECT column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'establishments' AND column_name = 'pagamento_adiantado_opcional_mercadopago') AS default_opcional,
  (SELECT count(*) FROM public.establishments WHERE coalesce(is_deleted, false) = false AND coalesce(exigir_pagamento_antecipado_mercadopago, false) = false) AS ativas_ainda_desligadas;

COMMIT;
