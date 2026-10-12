-- ============================================================================
-- "Fazer pedidos" (menu do estabelecimento) + respostas no Menu Admin.
-- ----------------------------------------------------------------------------
-- MOTIVO: o estabelecimento escreve um pedido de melhoria/novidade para o
-- sistema. No Menu Admin o suporte vê os pedidos, marca ACEITO ou NEGADO e pode
-- mandar uma mensagem. O estabelecimento vê a resposta na mesma tela.
--
-- O QUE FAZ:
--   1) Uma tabela NOVA (establishment_feature_requests), isolada.
--   2) 4 funções: enviar pedido (só o dono), ver os próprios pedidos (dono ou
--      admin), listar todos (só admin) e responder (só admin).
--   Ninguém lê nem grava direto na tabela: tudo passa pelas funções, que
--   conferem login + dono / admin (sem login = bloqueado).
--
-- RISCO: nenhum para o que já existe. Não mexe em nenhuma tabela, policy ou
-- função atual. Reversível: DROP das 4 funções e da tabela.
-- ============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.establishment_feature_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  admin_reply text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_feature_requests_establishment
  ON public.establishment_feature_requests (establishment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feature_requests_pending
  ON public.establishment_feature_requests (created_at DESC) WHERE status = 'pending';

-- Acesso só pelas funções abaixo.
ALTER TABLE public.establishment_feature_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.establishment_feature_requests FROM anon, authenticated;

-- 1) Dono envia um pedido
CREATE OR REPLACE FUNCTION public.create_feature_request(p_establishment_id uuid, p_message text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner uuid;
  v_msg text := btrim(coalesce(p_message, ''));
  v_row public.establishment_feature_requests%ROWTYPE;
BEGIN
  SELECT owner_id INTO v_owner FROM public.establishments WHERE id = p_establishment_id;
  -- auth.uid() NULL (sem login) precisa ser bloqueado explicitamente.
  IF v_owner IS NULL OR auth.uid() IS NULL OR v_owner IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  IF length(v_msg) < 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'too_short', 'message', 'Escreva um pouco mais sobre o seu pedido.');
  END IF;
  IF length(v_msg) > 2000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'too_long', 'message', 'O pedido pode ter no máximo 2000 letras.');
  END IF;
  -- Anti-spam: no máximo 10 pedidos aguardando resposta por estabelecimento.
  IF (SELECT count(*) FROM public.establishment_feature_requests
      WHERE establishment_id = p_establishment_id AND status = 'pending') >= 10 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'too_many_pending',
      'message', 'Você já tem 10 pedidos aguardando resposta. Aguarde o suporte responder.');
  END IF;

  INSERT INTO public.establishment_feature_requests (establishment_id, message, created_by)
  VALUES (p_establishment_id, v_msg, auth.uid())
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('ok', true, 'item', to_jsonb(v_row));
END;
$$;

-- 2) Dono (ou admin) vê os pedidos do estabelecimento
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
    SELECT id, establishment_id, message, status, admin_reply, created_at, answered_at
    FROM public.establishment_feature_requests
    WHERE establishment_id = p_establishment_id
    ORDER BY created_at DESC
    LIMIT 100
  ) r;

  RETURN jsonb_build_object('ok', true, 'items', v_items);
END;
$$;

-- 3) Admin: todos os pedidos (com nome e código do estabelecimento)
CREATE OR REPLACE FUNCTION public.admin_list_feature_requests()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_items jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_user() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden', 'items', '[]'::jsonb);
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC), '[]'::jsonb) INTO v_items
  FROM (
    SELECT f.id, f.establishment_id, f.message, f.status, f.admin_reply, f.created_at, f.answered_at,
           e.name AS establishment_name, e.code AS establishment_code
    FROM public.establishment_feature_requests f
    LEFT JOIN public.establishments e ON e.id = f.establishment_id
    ORDER BY f.created_at DESC
    LIMIT 3000
  ) r;

  RETURN jsonb_build_object('ok', true, 'items', v_items);
END;
$$;

-- 4) Admin responde: aceito / negado (ou volta para pendente) + mensagem opcional
CREATE OR REPLACE FUNCTION public.admin_answer_feature_request(p_request_id uuid, p_status text, p_reply text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.establishment_feature_requests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_user() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('accepted', 'rejected', 'pending') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status');
  END IF;

  UPDATE public.establishment_feature_requests
  SET status = p_status,
      admin_reply = nullif(btrim(coalesce(p_reply, '')), ''),
      answered_at = CASE WHEN p_status = 'pending' THEN NULL ELSE now() END
  WHERE id = p_request_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  RETURN jsonb_build_object('ok', true, 'item', to_jsonb(v_row));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_feature_request(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.list_my_feature_requests(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_feature_requests() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_answer_feature_request(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_feature_request(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_my_feature_requests(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_feature_requests() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_answer_feature_request(uuid, text, text) TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Conferência (rodar depois): as 4 linhas devem ter anon_pode_executar = false
-- SELECT p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_pode_executar
-- FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public' AND p.proname IN ('create_feature_request','list_my_feature_requests','admin_list_feature_requests','admin_answer_feature_request');
