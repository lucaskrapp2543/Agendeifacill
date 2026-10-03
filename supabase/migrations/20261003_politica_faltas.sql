-- =====================================================================
-- POLÍTICA DE FALTAS ("Política do sistema" na tela Saques / Pagamentos online)
-- =====================================================================
--
-- O QUE FAZ
--   Duas colunas novas em establishments, escolhidas pelo DONO da barbearia:
--     no_show_policy_enabled  -> liga/desliga (nasce DESLIGADA para todo mundo)
--     no_show_policy          -> o que acontece com o valor pago se o cliente faltar:
--                                'retain_50' | 'retain_30' | 'retain_20' | 'credit_next'
--   Quando ligada, o cliente vê um aviso bonito logo DEPOIS de pagar online
--   (nunca antes, nunca em agendamento sem pagamento).
--
-- RISCO: nenhum. Default desligado = nada muda. O dono edita as próprias colunas
--   (mesma permissão que já tem para as outras configurações). Reversível:
--   ALTER TABLE public.establishments DROP COLUMN no_show_policy_enabled, DROP COLUMN no_show_policy;
-- =====================================================================

BEGIN;

ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS no_show_policy_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS no_show_policy text NOT NULL DEFAULT 'retain_50';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'establishments_no_show_policy_check') THEN
    ALTER TABLE public.establishments
      ADD CONSTRAINT establishments_no_show_policy_check
      CHECK (no_show_policy IN ('retain_50', 'retain_30', 'retain_20', 'credit_next'));
  END IF;
END $$;

COMMENT ON COLUMN public.establishments.no_show_policy_enabled IS 'Política de faltas ligada: cliente vê o aviso após pagar online.';
COMMENT ON COLUMN public.establishments.no_show_policy IS 'retain_50 | retain_30 | retain_20 (barbearia fica com X% do pago em caso de falta) | credit_next (valor vira crédito para o próximo).';

-- Conferência: defaults e 0 ligadas
SELECT
  (SELECT column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'establishments' AND column_name = 'no_show_policy_enabled') AS default_ligada,
  (SELECT column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'establishments' AND column_name = 'no_show_policy') AS default_politica,
  (SELECT count(*) FROM public.establishments WHERE no_show_policy_enabled = true) AS barbearias_com_politica;

COMMIT;

NOTIFY pgrst, 'reload schema';
