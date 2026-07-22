-- ============================================================================
-- FASE 3 (parte B) — A TRAVA (v2): esconde os segredos do visitante anônimo
-- ----------------------------------------------------------------------------
-- IMPORTANTE (correção): no Postgres, um GRANT de nível-TABELA (ler a tabela
-- inteira) SOBREPÕE um REVOKE de coluna. Por isso "REVOKE SELECT (coluna)"
-- sozinho não teve efeito. O jeito certo é: REVOGAR o acesso à tabela inteira
-- e RE-CONCEDER só as colunas NÃO-secretas.
--
-- O bloco abaixo monta a lista de colunas permitidas SOZINHO (todas menos as 6
-- secretas), então não precisa listar as ~117 na mão nem se preocupar com
-- colunas futuras (novas colunas ficam ocultas por padrão = seguro).
--
-- Depois disto, para o role anon (chave pública, sem login):
--   - establishments?select=mercadopago_access_token  -> NEGADO
--   - establishments?select=*                          -> NEGADO
--   - establishments?select=name,code,pix_key,...      -> OK
--   - função get_establishment_public()                -> OK (SECURITY DEFINER)
--   - painel dono/admin (authenticated) e servidor      -> OK (não afetados)
--
-- Reversível: o GRANT no rollback (fim do arquivo) devolve o acesso na hora.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  v_cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ')
    INTO v_cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'establishments'
    AND column_name NOT IN (
      'mercadopago_access_token',
      'mercadopago_refresh_token',
      'pin_password',
      'second_password',
      'bank_cpf_cnpj',
      'pagarme_register_information'
    );

  -- Tira o acesso à tabela inteira e devolve só as colunas não-secretas.
  EXECUTE 'REVOKE SELECT ON public.establishments FROM anon';
  EXECUTE 'GRANT SELECT (' || v_cols || ') ON public.establishments TO anon';
END $$;

COMMIT;

-- Faz o PostgREST (a API) recarregar as permissões na hora.
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- ROLLBACK (se algo quebrar, cole e rode ISTO pra voltar ao de antes):
--
-- GRANT SELECT ON public.establishments TO anon;
-- NOTIFY pgrst, 'reload schema';
-- ============================================================================
