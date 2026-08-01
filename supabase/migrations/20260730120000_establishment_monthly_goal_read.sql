-- =============================================================================
-- 🏆 META MENSAL — Etapa 4: leitura segura do progresso pelo ESTABELECIMENTO
-- -----------------------------------------------------------------------------
-- MOTIVO
--   O ledger `admin_mp_commissions` (fonte oficial do "Meus R$1") é RLS
--   somente-admin. O estabelecimento não consegue ler a própria contagem.
--   Estas funções devolvem APENAS o agregado do próprio estabelecimento,
--   sem expor nenhuma linha do ledger nem dados de outros estabelecimentos.
--
-- IMPACTO
--   Aditivo. NÃO cria tabela. NÃO altera tabela, coluna, policy ou dado.
--   NÃO toca em cobrança, Mercado Pago, assinatura, token ou WhatsApp.
--   Somente SELECT agregado.
--
-- RISCO
--   Baixo. Reversível com os DROP FUNCTION no fim do arquivo.
--
-- ANTES DE RODAR: execute 20260730120000_establishment_monthly_goal_read_VERIFY.sql
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0) Preflight — aborta sem alterar nada se faltar dependência
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_missing text := '';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'admin_mp_commissions'
  ) THEN
    v_missing := v_missing || ' admin_mp_commissions';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'establishments' AND column_name = 'owner_id'
  ) THEN
    v_missing := v_missing || ' establishments.owner_id';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'establishments' AND column_name = 'mercadopago_billing_amount'
  ) THEN
    v_missing := v_missing || ' establishments.mercadopago_billing_amount';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_admin_user'
  ) THEN
    v_missing := v_missing || ' is_admin_user()';
  END IF;

  IF v_missing <> '' THEN
    RAISE EXCEPTION 'Migration Meta Mensal (leitura) abortada. Dependências faltando:%', v_missing;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1) Mês de referência no fuso de São Paulo (evita erro na virada do mês)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.monthly_goal_sp_month_date()
RETURNS date
LANGUAGE sql
STABLE
AS $$
  SELECT date_trunc('month', timezone('America/Sao_Paulo', now()))::date;
$$;

-- ---------------------------------------------------------------------------
-- 2) Contagem de pagamentos válidos do mês
--    MESMOS filtros da leitura oficial do admin: status='paid' + paid_at no mês.
--    Conta LINHAS (não centavos) para a meta não quebrar se a taxa mudar.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.count_establishment_valid_payments(
  p_establishment_id uuid,
  p_month date DEFAULT NULL
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM public.admin_mp_commissions c
  WHERE c.establishment_id = p_establishment_id
    AND c.status = 'paid'
    AND c.paid_at >= coalesce(p_month, public.monthly_goal_sp_month_date())::timestamptz
    AND c.paid_at <  (coalesce(p_month, public.monthly_goal_sp_month_date()) + interval '1 month')::timestamptz;
$$;

-- ---------------------------------------------------------------------------
-- 3) Progresso da Meta Mensal do estabelecimento
--    Só o DONO do estabelecimento (ou o admin) consegue ler — e recebe apenas
--    números agregados, nunca linhas do ledger.
--    Retorna o valor da mensalidade já resolvido (valor próprio > fallback global).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_establishment_monthly_goal(
  p_establishment_id uuid,
  p_month date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id        uuid;
  v_month           date := coalesce(p_month, public.monthly_goal_sp_month_date());
  v_start           timestamptz;
  v_end             timestamptz;
  v_total           integer := 0;
  v_pix             integer := 0;
  v_credito         integer := 0;
  v_appointment     integer := 0;
  v_subscription    integer := 0;
  v_cents           integer := 0;
  v_est_amount      numeric := 0;
  v_global_amount   numeric := 0;
  v_plan_cents      integer := 0;
BEGIN
  IF p_establishment_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_establishment_id');
  END IF;

  SELECT e.owner_id, coalesce(e.mercadopago_billing_amount, 0)
    INTO v_owner_id, v_est_amount
  FROM public.establishments e
  WHERE e.id = p_establishment_id;

  IF v_owner_id IS NULL AND NOT public.is_admin_user() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'establishment_not_found');
  END IF;

  -- Trava de acesso: só o dono ou o admin
  IF NOT public.is_admin_user() AND (v_owner_id IS NULL OR v_owner_id <> auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  v_start := v_month::timestamptz;
  v_end   := (v_month + interval '1 month')::timestamptz;

  SELECT
    count(*)::integer,
    count(*) FILTER (WHERE c.payment_method = 'pix')::integer,
    count(*) FILTER (WHERE c.payment_method = 'credito')::integer,
    count(*) FILTER (WHERE c.source_type = 'appointment')::integer,
    count(*) FILTER (WHERE c.source_type = 'subscription')::integer,
    coalesce(sum(c.commission_cents), 0)::integer
  INTO v_total, v_pix, v_credito, v_appointment, v_subscription, v_cents
  FROM public.admin_mp_commissions c
  WHERE c.establishment_id = p_establishment_id
    AND c.status = 'paid'
    AND c.paid_at >= v_start
    AND c.paid_at <  v_end;

  -- Valor da mensalidade: valor próprio do estabelecimento; se não houver,
  -- fallback global (mesma resolução usada ao criar cobrança no backend).
  IF coalesce(v_est_amount, 0) <= 0 THEN
    SELECT coalesce(l.mercadopago_billing_amount, 0) INTO v_global_amount
    FROM public.admin_billing_links l
    WHERE l.id = 'global';
    v_plan_cents := round(coalesce(v_global_amount, 0) * 100)::integer;
  ELSE
    v_plan_cents := round(v_est_amount * 100)::integer;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'reference_month', v_month,
    'valid_payments', coalesce(v_total, 0),
    'pix_count', coalesce(v_pix, 0),
    'credit_count', coalesce(v_credito, 0),
    'appointment_count', coalesce(v_appointment, 0),
    'subscription_count', coalesce(v_subscription, 0),
    'commission_cents', coalesce(v_cents, 0),
    'plan_amount_cents', coalesce(v_plan_cents, 0),
    'source', 'admin_mp_commissions'
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 4) Grants
--    count_establishment_valid_payments NÃO recebe grant público: é auxiliar
--    interna. O acesso do estabelecimento passa só pela função com trava.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.count_establishment_valid_payments(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.monthly_goal_sp_month_date() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_establishment_monthly_goal(uuid, date) TO authenticated;

COMMIT;

-- =============================================================================
-- ROLLBACK (se precisar desfazer — remove só o que esta migration criou):
--
-- DROP FUNCTION IF EXISTS public.get_establishment_monthly_goal(uuid, date);
-- DROP FUNCTION IF EXISTS public.count_establishment_valid_payments(uuid, date);
-- DROP FUNCTION IF EXISTS public.monthly_goal_sp_month_date();
-- =============================================================================
