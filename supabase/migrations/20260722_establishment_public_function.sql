-- ============================================================================
-- FASE 3 (parte A) — função pública que devolve o estabelecimento SEM segredos
-- ----------------------------------------------------------------------------
-- Devolve a linha do estabelecimento (por código), com TODAS as colunas MENOS
-- as secretas (tokens do Mercado Pago, refresh, senhas, CPF/CNPJ bancário e
-- dados de cadastro Pagar.me). Usa `to_jsonb(e) - 'coluna'`, então não precisa
-- listar as ~117 colunas boas — pega tudo e só tira as 6 secretas.
--
-- A "plaquinha" has_mercadopago, a chave PIX, o pagarme_recipient_id e os dados
-- do profissional continuam vindo (o booking precisa deles).
--
-- IMPORTANTE: aditivo. Só cria a função. Não altera dados, não remove nada, não
-- mexe em pagamento. O booking passa a usar esta função; o servidor continua
-- lendo os tokens direto (service_role, não afetado). Reversível com DROP.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_establishment_public(p_code text)
RETURNS SETOF jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(e)
         - 'mercadopago_access_token'
         - 'mercadopago_refresh_token'
         - 'pin_password'
         - 'second_password'
         - 'bank_cpf_cnpj'
         - 'pagarme_register_information'
  FROM public.establishments e
  WHERE e.code = p_code
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_establishment_public(text) TO anon, authenticated;

-- ROLLBACK:
-- DROP FUNCTION IF EXISTS public.get_establishment_public(text);
