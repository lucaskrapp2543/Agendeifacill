-- ============================================================================
-- "Fazer pedidos": contador de PEDIDOS ACEITOS mostrado para todos os estabelecimentos.
-- ----------------------------------------------------------------------------
-- MOTIVO: a tela "Fazer pedidos" mostra em destaque quantos pedidos o suporte já
-- aceitou. Começa em 344 (total até hoje) e soma +1 a cada "Pedido aceito" dado no
-- Menu Admin DEPOIS que este arquivo for rodado.
--
-- O QUE FAZ: cria 1 função que devolve SÓ um número (sem nome, texto ou dado de
-- ninguém). Pode ser lida por quem está logado.
--
-- PODE RODAR MAIS DE UMA VEZ: se a função já existir, nada muda (o contador não zera).
-- RISCO: nenhum. Não mexe em tabelas, pedidos nem permissões existentes.
-- ============================================================================
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'feature_requests_accepted_total'
  ) THEN
    -- A data/hora de agora fica gravada dentro da função: só contam aceites a partir daqui.
    EXECUTE format($f$
      CREATE FUNCTION public.feature_requests_accepted_total()
      RETURNS integer
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      AS $body$
        SELECT 344 + count(*)::int
        FROM public.establishment_feature_requests
        WHERE status = 'accepted'
          AND answered_at >= %L::timestamptz
      $body$;
    $f$, now());
  END IF;
END
$do$;

REVOKE EXECUTE ON FUNCTION public.feature_requests_accepted_total() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.feature_requests_accepted_total() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- Conferência: deve devolver 344 logo depois de rodar
-- SELECT public.feature_requests_accepted_total();
