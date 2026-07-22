-- ============================================================================
-- FASE 3 (parte B) — A TRAVA: esconde os segredos do visitante anônimo
-- ----------------------------------------------------------------------------
-- Tira do role `anon` (a chave pública do site, sem login — a que o "consultor"
-- usou) a permissão de LER as 6 colunas secretas da tabela establishments.
--
-- Depois disto:
--   - `establishments?select=mercadopago_access_token` (anon)  -> NEGADO
--   - `establishments?select=*` (anon)                         -> NEGADO (tem coluna secreta)
--   - `establishments?select=name,code,pix_key,...` (anon)     -> OK (colunas não-secretas)
--   - Booking usa a função get_establishment_public()          -> OK (traz tudo menos os segredos)
--   - Painel do dono / admin (authenticated)                   -> OK (não são afetados)
--   - Servidor (service_role)                                  -> OK (ignora, continua pagando)
--
-- NÃO APLICAR ANTES de: (1) deployar o frontend novo e (2) colar a função
-- (parte A). Senão a tela /af, que usa `select *`, ficaria sem a função e sem
-- o `*`. Ordem correta: deploy frontend -> colar parte A -> testar -> colar esta.
--
-- Reversível: o GRANT no fim do arquivo (comentado) devolve o acesso na hora.
-- ============================================================================

BEGIN;

REVOKE SELECT (
  mercadopago_access_token,
  mercadopago_refresh_token,
  pin_password,
  second_password,
  bank_cpf_cnpj,
  pagarme_register_information
) ON public.establishments FROM anon;

COMMIT;

-- ============================================================================
-- ROLLBACK (se algo quebrar, cole e rode ISTO pra devolver o acesso na hora):
--
-- GRANT SELECT (
--   mercadopago_access_token,
--   mercadopago_refresh_token,
--   pin_password,
--   second_password,
--   bank_cpf_cnpj,
--   pagarme_register_information
-- ) ON public.establishments TO anon;
-- ============================================================================
