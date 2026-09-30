-- =====================================================================
-- CARTEIRA (SALDO E SAQUES) — pagamentos online recebidos pela conta do
-- Agendei Fácil em nome de estabelecimentos SEM Mercado Pago conectado
-- =====================================================================
--
-- O QUE MUDA
--   Hoje, estabelecimento sem Mercado Pago não tem pagamento online: o cliente
--   nunca vê a opção. A partir desta migration + código:
--     1. o cliente paga online (PIX/cartão) e o dinheiro cai na conta do Mercado
--        Pago do Agendei Fácil (a mesma que recebe as mensalidades);
--     2. o estabelecimento vê "Seu saldo" = valor LÍQUIDO (já sem a taxa do
--        Mercado Pago e sem R$ 1,00 de serviço da plataforma);
--     3. ele pede saque; o admin vê "SALDO A PAGAR" e marca como pago quando
--        envia o PIX; o estabelecimento vê "Aprovado".
--   Quem TEM Mercado Pago conectado não muda nada: continua recebendo direto.
--
-- O QUE ESTA MIGRATION CRIA (tudo novo, nada existente é alterado)
--   - platform_collected_payments: cada pagamento aprovado na conta da plataforma
--     (bruto, taxa MP, taxa de serviço, líquido). Só o webhook (service_role) grava.
--   - establishment_withdrawal_requests: pedidos de saque (pendente / pago / cancelado).
--   - funções: saldo, resumo da carteira (dono), pedir saque (dono),
--     listar carteiras e marcar pago (admin).
--   - UPDATE de dados: TODO estabelecimento ativo que ainda estiver com cobrança
--     online desligada passa a "Online e no local" (opção "Apenas no local" não
--     existe mais desde 29/09/2026). Quem já está ligado não muda.
--
-- RISCO
--   Baixo: tabelas e funções novas, RLS fechada (dono lê só o seu, admin lê tudo,
--   escrita só por função ou service_role). Reversível com os DROPs no fim (comentados).
-- =====================================================================

BEGIN;

-- Preflight
DO $$
DECLARE v_missing text := '';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='establishments' AND column_name='owner_id') THEN v_missing := v_missing || ' establishments.owner_id'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='establishments' AND column_name='pix_key') THEN v_missing := v_missing || ' establishments.pix_key'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='is_admin_user') THEN v_missing := v_missing || ' is_admin_user()'; END IF;
  IF v_missing <> '' THEN RAISE EXCEPTION 'Migration carteira abortada. Faltando:%', v_missing; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ---------------------------------------------------------------------
-- 1) Pagamentos recebidos pela plataforma
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_collected_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  appointment_id uuid NULL,
  mp_payment_id text NOT NULL UNIQUE,
  gross_cents integer NOT NULL CHECK (gross_cents >= 0),
  mp_fee_cents integer NOT NULL DEFAULT 0 CHECK (mp_fee_cents >= 0),
  platform_fee_cents integer NOT NULL DEFAULT 100 CHECK (platform_fee_cents >= 0),
  net_cents integer NOT NULL CHECK (net_cents >= 0),
  payment_method text NULL,
  payer_name text NULL,
  status text NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'refunded', 'chargeback')),
  refunded_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.platform_collected_payments IS 'Pagamentos online aprovados na conta Mercado Pago do Agendei Fácil em nome de estabelecimentos sem MP conectado. net_cents = bruto - taxa MP - taxa de serviço. Base do saldo/saque.';
CREATE INDEX IF NOT EXISTS idx_pcp_establishment_created ON public.platform_collected_payments (establishment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pcp_appointment ON public.platform_collected_payments (appointment_id);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_pcp_updated_at') THEN
    CREATE TRIGGER trg_pcp_updated_at BEFORE UPDATE ON public.platform_collected_payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

ALTER TABLE public.platform_collected_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Dono le seus pagamentos na plataforma" ON public.platform_collected_payments;
CREATE POLICY "Dono le seus pagamentos na plataforma" ON public.platform_collected_payments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.establishments e WHERE e.id = platform_collected_payments.establishment_id AND e.owner_id = auth.uid()));
DROP POLICY IF EXISTS "Admin le todos os pagamentos na plataforma" ON public.platform_collected_payments;
CREATE POLICY "Admin le todos os pagamentos na plataforma" ON public.platform_collected_payments
  FOR SELECT TO authenticated USING (public.is_admin_user());
GRANT SELECT ON public.platform_collected_payments TO authenticated;
GRANT ALL ON public.platform_collected_payments TO service_role;

-- ---------------------------------------------------------------------
-- 2) Pedidos de saque
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.establishment_withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  pix_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz NULL,
  paid_by uuid NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.establishment_withdrawal_requests IS 'Pedidos de saque do saldo da carteira (pagamentos recebidos pela plataforma). O admin marca como pago ao enviar o PIX.';
CREATE INDEX IF NOT EXISTS idx_ewr_establishment ON public.establishment_withdrawal_requests (establishment_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_ewr_status ON public.establishment_withdrawal_requests (status);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_ewr_updated_at') THEN
    CREATE TRIGGER trg_ewr_updated_at BEFORE UPDATE ON public.establishment_withdrawal_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

ALTER TABLE public.establishment_withdrawal_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Dono le seus saques" ON public.establishment_withdrawal_requests;
CREATE POLICY "Dono le seus saques" ON public.establishment_withdrawal_requests
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.establishments e WHERE e.id = establishment_withdrawal_requests.establishment_id AND e.owner_id = auth.uid()));
DROP POLICY IF EXISTS "Admin le todos os saques" ON public.establishment_withdrawal_requests;
CREATE POLICY "Admin le todos os saques" ON public.establishment_withdrawal_requests
  FOR SELECT TO authenticated USING (public.is_admin_user());
GRANT SELECT ON public.establishment_withdrawal_requests TO authenticated;
GRANT ALL ON public.establishment_withdrawal_requests TO service_role;

-- ---------------------------------------------------------------------
-- 3) Saldo = líquido recebido - saques (pendentes + pagos)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.establishment_wallet_balance_cents(p_establishment_id uuid)
RETURNS integer LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT GREATEST(0,
    coalesce((SELECT sum(net_cents) FROM public.platform_collected_payments WHERE establishment_id = p_establishment_id AND status = 'approved'), 0)
    - coalesce((SELECT sum(amount_cents) FROM public.establishment_withdrawal_requests WHERE establishment_id = p_establishment_id AND status IN ('pending', 'paid')), 0)
  )::integer;
$$;

-- Resumo da carteira para o dono (ou admin)
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
  -- "v_owner <> NULL" dá NULL e o IF não bloqueia (hotfix 20260930).
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

-- Pedido de saque (dono): saca o saldo inteiro, um pedido pendente por vez
CREATE OR REPLACE FUNCTION public.request_establishment_withdrawal(p_establishment_id uuid, p_pix_key text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner uuid;
  v_balance integer;
  v_pix text;
  v_row public.establishment_withdrawal_requests%ROWTYPE;
BEGIN
  SELECT owner_id, nullif(trim(coalesce(p_pix_key, pix_key, '')), '') INTO v_owner, v_pix FROM public.establishments WHERE id = p_establishment_id;
  -- Sem login (auth.uid() NULL) ou não é o dono: bloqueia (hotfix 20260930).
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

-- Admin: carteiras de todos os estabelecimentos (saldo a pagar + pedido pendente)
CREATE OR REPLACE FUNCTION public.admin_list_establishment_wallets()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_items jsonb;
BEGIN
  IF NOT public.is_admin_user() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden', 'items', '[]'::jsonb);
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'establishment_id', w.establishment_id,
      'balance_cents', public.establishment_wallet_balance_cents(w.establishment_id),
      'total_received_cents', w.total_received_cents,
      'total_paid_cents', coalesce((SELECT sum(amount_cents) FROM public.establishment_withdrawal_requests r WHERE r.establishment_id = w.establishment_id AND r.status = 'paid'), 0),
      'pending_request', (SELECT to_jsonb(x) FROM (SELECT id, amount_cents, requested_at, pix_key FROM public.establishment_withdrawal_requests r WHERE r.establishment_id = w.establishment_id AND r.status = 'pending' ORDER BY requested_at DESC LIMIT 1) x)
    )), '[]'::jsonb)
    INTO v_items
  FROM (
    SELECT establishment_id, sum(net_cents) FILTER (WHERE status = 'approved') AS total_received_cents
    FROM public.platform_collected_payments GROUP BY establishment_id
    UNION
    SELECT establishment_id, 0 FROM public.establishment_withdrawal_requests
      WHERE establishment_id NOT IN (SELECT establishment_id FROM public.platform_collected_payments)
  ) w;
  RETURN jsonb_build_object('ok', true, 'items', v_items);
END;
$$;

-- Admin: marcar saque como pago (quando enviou o PIX) ou cancelar
CREATE OR REPLACE FUNCTION public.admin_update_establishment_withdrawal_request(p_request_id uuid, p_action text, p_notes text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.establishment_withdrawal_requests%ROWTYPE;
  v_action text := lower(trim(coalesce(p_action, '')));
BEGIN
  IF NOT public.is_admin_user() THEN RETURN jsonb_build_object('ok', false, 'error', 'forbidden'); END IF;
  SELECT * INTO v_row FROM public.establishment_withdrawal_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF v_row.status <> 'pending' THEN RETURN jsonb_build_object('ok', false, 'error', 'not_pending', 'message', 'Este pedido já foi finalizado.'); END IF;
  IF v_action = 'paid' THEN
    UPDATE public.establishment_withdrawal_requests SET status = 'paid', paid_at = now(), paid_by = auth.uid(), notes = nullif(trim(coalesce(p_notes, notes, '')), '') WHERE id = p_request_id RETURNING * INTO v_row;
  ELSIF v_action = 'cancel' THEN
    UPDATE public.establishment_withdrawal_requests SET status = 'cancelled', notes = nullif(trim(coalesce(p_notes, notes, '')), '') WHERE id = p_request_id RETURNING * INTO v_row;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_action');
  END IF;
  RETURN jsonb_build_object('ok', true, 'request', jsonb_build_object('id', v_row.id, 'amount_cents', v_row.amount_cents, 'status', v_row.status, 'paid_at', v_row.paid_at));
END;
$$;

-- CREATE FUNCTION dá EXECUTE a PUBLIC por padrão: tirar de anon (só logado chama)
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

-- ---------------------------------------------------------------------
-- 4) Dados: sem Mercado Pago e cobrança desligada -> "Online e no local"
--    ("Apenas no local" deixou de existir em 29/09/2026)
-- ---------------------------------------------------------------------
UPDATE public.establishments
SET exigir_pagamento_antecipado_mercadopago = true,
    pagamento_adiantado_opcional_mercadopago = true
WHERE coalesce(is_deleted, false) = false
  AND coalesce(exigir_pagamento_antecipado_mercadopago, false) = false;

-- Conferência
SELECT
  (SELECT count(*) FROM pg_tables WHERE tablename IN ('platform_collected_payments', 'establishment_withdrawal_requests')) AS tabelas_criadas,
  (SELECT count(*) FROM pg_proc WHERE proname IN ('get_establishment_wallet', 'request_establishment_withdrawal', 'admin_list_establishment_wallets', 'admin_update_establishment_withdrawal_request', 'establishment_wallet_balance_cents')) AS funcoes_criadas,
  (SELECT count(*) FROM public.establishments WHERE coalesce(is_deleted, false) = false AND coalesce(exigir_pagamento_antecipado_mercadopago, false) = false) AS ainda_com_cobranca_desligada;

COMMIT;

-- Reverter (se precisar):
-- DROP FUNCTION IF EXISTS public.admin_update_establishment_withdrawal_request(uuid, text, text);
-- DROP FUNCTION IF EXISTS public.admin_list_establishment_wallets();
-- DROP FUNCTION IF EXISTS public.request_establishment_withdrawal(uuid, text);
-- DROP FUNCTION IF EXISTS public.get_establishment_wallet(uuid);
-- DROP FUNCTION IF EXISTS public.establishment_wallet_balance_cents(uuid);
-- DROP TABLE IF EXISTS public.establishment_withdrawal_requests;
-- DROP TABLE IF EXISTS public.platform_collected_payments;
