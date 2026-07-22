-- ============================================================================
-- FASE 3 (parte C) — fecha a "porta extra" do mercadopago_access_token
-- ----------------------------------------------------------------------------
-- A trava (parte B) fechou 5 das 6 colunas secretas. O mercadopago_access_token
-- continuou visível porque tinha um GRANT de COLUNA específico (dado no passado,
-- provavelmente pra o booking checar "tem MP?") — e um REVOKE de nível-tabela
-- NÃO remove um grant de nível-coluna. Este arquivo remove esse grant específico,
-- do `anon` e do pseudo-role `PUBLIC` (que o anon herda), cobrindo os dois casos.
--
-- Seguro: nenhum código do site usa mais o VALOR do token (usa a plaquinha
-- has_mercadopago). O servidor lê via service_role (não afetado).
-- Reversível: GRANT no rollback (fim do arquivo).
-- ============================================================================

BEGIN;

REVOKE SELECT (mercadopago_access_token) ON public.establishments FROM anon;
REVOKE SELECT (mercadopago_access_token) ON public.establishments FROM PUBLIC;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- ROLLBACK:
-- GRANT SELECT (mercadopago_access_token) ON public.establishments TO anon;
-- NOTIFY pgrst, 'reload schema';
-- ============================================================================
