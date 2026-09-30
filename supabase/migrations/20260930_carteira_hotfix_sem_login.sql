-- =====================================================================
-- HOTFIX CARTEIRA — bloquear chamada SEM LOGIN (anon / service_role)
-- Rodar DEPOIS de 20260929_carteira_pagamentos_plataforma.sql
-- =====================================================================
--
-- PROBLEMA (encontrado em teste, 30/09/2026)
--   As funções get_establishment_wallet e request_establishment_withdrawal
--   comparavam "owner_id <> auth.uid()". Sem login, auth.uid() é NULL e a
--   comparação vira NULL, então o IF NÃO bloqueava. Como CREATE FUNCTION dá
--   EXECUTE para todo mundo (PUBLIC) por padrão, qualquer pessoa com a chave
--   pública (anon) conseguia:
--     - ler a carteira de qualquer estabelecimento (pagamentos, chave PIX dos saques);
--     - pedir saque em nome de qualquer estabelecimento e, pior, TROCAR a chave
--       PIX do cadastro dele pela que quisesse (quando houvesse saldo).
--   Nenhum saldo existia ainda (tabelas vazias), então nada foi movido.
--
-- O QUE ESTE ARQUIVO FAZ
--   1. Recria as duas funções exigindo auth.uid() NÃO NULO e usando IS DISTINCT FROM.
--   2. Tira o EXECUTE de PUBLIC e anon das 5 funções da carteira (fica só authenticated).
--   3. Conferência no fim: "anon_pode_executar" tem que ser false em todas.
--
-- RISCO: nenhum para quem está logado. Reversível recriando a versão anterior.
-- =====================================================================

BEGIN;

-- 1) Resumo da carteira (dono ou admin) — bloqueia sem login
CREATE OR REPLACE FUNCTION public.get_establishment_wallet(p_establishment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner uuid;
  v_pending jsonb;
  v_requests jsonb;
  v_payments jsonb;
BEGIN
  SELECT owner_id INTO v_owner FROM public.establishments WHERE id = p_establishment_id;
  -- auth.uid() NULL (sem login) tem que ser bloqueado explicitamente:
  -- "v_owner <> NULL" dá NULL e o IF não bloqueia.
  IF v_owner IS NULL OR auth.uid() IS NULL
     OR (v_owner IS DISTINCT FROM auth.uid() AND NOT public.is_admin_user()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'amount_cents', r.amount_cents, 'status', r.status, 'requested_at', r.requested_at, 'paid_at', r.paid_at, 'pix_key', r.pix_key) ORDER BY r.requested_at DESC), '[]'::jsonb)
    INTO v_requests
  FROM (SELECT * FROM public.establishment_withdrawal_requests WHERE establishment_id = p_establishment_id ORDER BY requested_at DESC LIMIT 30) r;

  SELECT to_jsonb(r) INTO v_pending
  FROM (SELECT id, amount_cents, requested_at, pix_key FROM public.establishment_withdrawal_requests WHERE establishment_id = p_establishment_id AND status = 'pending' ORDER BY requested_at DESC LIMIT 1) r;

  SELECT coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'appointment_id', p.appointment_id, 'gross_cents', p.gross_cents, 'net_cents', p.net_cents, 'payment_method', p.payment_method, 'payer_name', p.payer_name, 'status', p.status, 'created_at', p.created_at) ORDER BY p.created_at DESC), '[]'::jsonb)
    INTO v_payments
  FROM (SELECT * FROM public.platform_collected_payments WHERE establishment_id = p_establishment_id ORDER BY created_at DESC LIMIT 50) p;

  RETURN jsonb_build_object(
    'ok', true,
    'balance_cents', public.establishment_wallet_balance_cents(p_establishment_id),
    'total_received_cents', coalesce((SELECT sum(net_cents) FROM public.platform_collected_payments WHERE establishment_id = p_establishment_id AND status = 'approved'), 0),
    'total_paid_cents', coalesce((SELECT sum(amount_cents) FROM public.establishment_withdrawal_requests WHERE establishment_id = p_establishment_id AND status = 'paid'), 0),
    'pending_request', v_pending,
    'requests', v_requests,
    'payments', v_payments
  );
END;
$$;

-- 2) Pedido de saque (só o dono logado)
CREATE OR REPLACE FUNCTION public.request_establishment_withdrawal(p_establishment_id uuid, p_pix_key text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner uuid;
  v_balance integer;
  v_pix text;
  v_row public.establishment_withdrawal_requests%ROWTYPE;
BEGIN
  SELECT owner_id, nullif(trim(coalesce(p_pix_key, pix_key, '')), '') INTO v_owner, v_pix FROM public.establishments WHERE id = p_establishment_id;
  -- Sem login (auth.uid() NULL) ou não é o dono: bloqueia.
  IF v_owner IS NULL OR auth.uid() IS NULL OR v_owner IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  IF v_pix IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_pix_key', 'message', 'Informe sua chave PIX para receber o saque.');
  END IF;
  IF EXISTS (SELECT 1 FROM public.establishment_withdrawal_requests WHERE establishment_id = p_establishment_id AND status = 'pending') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_pending', 'message', 'Você já tem um pedido de saque em andamento.');
  END IF;

  -- Trava a linha do estabelecimento para dois cliques não sacarem duas vezes
  PERFORM 1 FROM public.establishments WHERE id = p_establishment_id FOR UPDATE;
  v_balance := public.establishment_wallet_balance_cents(p_establishment_id);
  IF coalesce(v_balance, 0) <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'zero_balance', 'message', 'Você ainda não tem saldo para sacar.');
  END IF;

  -- Guarda a chave PIX usada no pedido (e atualiza a do cadastro se veio nova)
  IF p_pix_key IS NOT NULL AND trim(p_pix_key) <> '' THEN
    UPDATE public.establishments SET pix_key = trim(p_pix_key) WHERE id = p_establishment_id;
  END IF;

  INSERT INTO public.establishment_withdrawal_requests (establishment_id, amount_cents, pix_key, status)
  VALUES (p_establishment_id, v_balance, v_pix, 'pending')
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('ok', true, 'request', jsonb_build_object('id', v_row.id, 'amount_cents', v_row.amount_cents, 'status', v_row.status, 'requested_at', v_row.requested_at, 'pix_key', v_row.pix_key));
END;
$$;

-- 3) Só usuário logado pode chamar as funções da carteira
REVOKE EXECUTE ON FUNCTION public.establishment_wallet_balance_cents(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_establishment_wallet(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.request_establishment_withdrawal(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_establishment_wallets() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_establishment_withdrawal_request(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.establishment_wallet_balance_cents(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_establishment_wallet(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.request_establishment_withdrawal(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_establishment_wallets() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_establishment_withdrawal_request(uuid, text, text) TO authenticated, service_role;

-- Conferência: anon_pode_executar tem que ser FALSE nas 5 linhas
SELECT p.proname AS funcao,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_pode_executar,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS logado_pode_executar
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('establishment_wallet_balance_cents', 'get_establishment_wallet', 'request_establishment_withdrawal', 'admin_list_establishment_wallets', 'admin_update_establishment_withdrawal_request')
ORDER BY 1;

COMMIT;
