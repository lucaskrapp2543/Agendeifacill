-- ============================================================================
-- "Fazer pedidos": aviso de RESPOSTA NOVA do suporte (balão vermelho no menu).
-- ----------------------------------------------------------------------------
-- MOTIVO: quando o admin responde (aceito / negado / mensagem), o estabelecimento
-- precisa ver um aviso no botão "Fazer pedidos" até abrir a tela.
--
-- O QUE FAZ:
--   1) Campo answer_seen_at no pedido (quando o dono viu a resposta).
--   2) Função que conta respostas ainda não vistas (só do próprio estabelecimento).
--   3) Função que marca como vistas (chamada ao abrir a tela "Fazer pedidos").
--   4) A lista de pedidos passa a devolver answer_seen_at (para marcar "Nova resposta").
--   Responder de novo um pedido já visto faz o aviso voltar (resposta mais nova).
--
-- RODAR DEPOIS de 20261016_pedidos_fotos.sql (já rodado).
-- RISCO: nenhum. Não mexe em pedidos, fotos, contador nem permissões existentes.
-- ============================================================================
BEGIN;

ALTER TABLE public.establishment_feature_requests
  ADD COLUMN IF NOT EXISTS answer_seen_at timestamptz;

-- Quantas respostas o dono ainda não viu
CREATE OR REPLACE FUNCTION public.count_unread_feature_request_answers(p_establishment_id uuid)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner uuid;
  v_count integer;
BEGIN
  SELECT owner_id INTO v_owner FROM public.establishments WHERE id = p_establishment_id;
  IF v_owner IS NULL OR auth.uid() IS NULL OR v_owner IS DISTINCT FROM auth.uid() THEN
    RETURN 0;
  END IF;
  SELECT count(*)::int INTO v_count
  FROM public.establishment_feature_requests
  WHERE establishment_id = p_establishment_id
    AND answered_at IS NOT NULL
    AND (answer_seen_at IS NULL OR answer_seen_at < answered_at);
  RETURN coalesce(v_count, 0);
END;
$$;

-- Marca as respostas como vistas (ao abrir "Fazer pedidos")
CREATE OR REPLACE FUNCTION public.mark_feature_request_answers_seen(p_establishment_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner uuid;
  v_updated integer;
BEGIN
  SELECT owner_id INTO v_owner FROM public.establishments WHERE id = p_establishment_id;
  IF v_owner IS NULL OR auth.uid() IS NULL OR v_owner IS DISTINCT FROM auth.uid() THEN
    RETURN 0;
  END IF;
  UPDATE public.establishment_feature_requests
  SET answer_seen_at = now()
  WHERE establishment_id = p_establishment_id
    AND answered_at IS NOT NULL
    AND (answer_seen_at IS NULL OR answer_seen_at < answered_at);
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

-- Lista do dono: agora com answer_seen_at (mantém as fotos)
CREATE OR REPLACE FUNCTION public.list_my_feature_requests(p_establishment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner uuid;
  v_items jsonb;
BEGIN
  SELECT owner_id INTO v_owner FROM public.establishments WHERE id = p_establishment_id;
  IF v_owner IS NULL OR auth.uid() IS NULL
     OR (v_owner IS DISTINCT FROM auth.uid() AND NOT public.is_admin_user()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden', 'items', '[]'::jsonb);
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC), '[]'::jsonb) INTO v_items
  FROM (
    SELECT id, establishment_id, message, status, admin_reply, created_at, answered_at, photo_paths, answer_seen_at
    FROM public.establishment_feature_requests
    WHERE establishment_id = p_establishment_id
    ORDER BY created_at DESC
    LIMIT 100
  ) r;

  RETURN jsonb_build_object('ok', true, 'items', v_items);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.count_unread_feature_request_answers(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_feature_request_answers_seen(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.count_unread_feature_request_answers(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_feature_request_answers_seen(uuid) TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
