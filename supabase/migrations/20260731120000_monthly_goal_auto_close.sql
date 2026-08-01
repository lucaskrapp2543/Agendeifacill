-- =============================================================================
-- 🏆 META MENSAL — fechamento AUTOMÁTICO do mês anterior
-- -----------------------------------------------------------------------------
-- MOTIVO
--   O fechamento era um botão manual: se ninguém clicasse todo dia 1º, o
--   barbeiro abria o app e não via desconto nenhum. Agora o mês anterior é
--   congelado sozinho, por estabelecimento, na hora em que o crédito é
--   consultado. Ninguém precisa lembrar de nada.
--
-- IMPACTO
--   Cria 1 função nova e substitui 2 já existentes (get/consume do crédito).
--   NÃO altera tabela, NÃO altera cobrança, NÃO toca em Mercado Pago,
--   preapproval, webhook, token ou WhatsApp.
--   admin_close_monthly_goals() continua existindo e funcionando — vira um
--   recurso de reprocessamento em massa, não mais a única forma de fechar.
--
-- CORREÇÃO DE REGRA (importante)
--   A busca do crédito olhava "o mês fechado mais recente com percentual > 0".
--   Isso permitia usar em setembro um desconto conquistado em julho, o que
--   contraria a regra combinada: cada mês vale APENAS o mês imediatamente
--   anterior. Agora a busca é ancorada no mês anterior e ponto.
--
-- IDEMPOTÊNCIA
--   O congelamento sai por UNIQUE (establishment_id, reference_month) +
--   ON CONFLICT DO NOTHING. Rodar mil vezes é igual a rodar uma: nunca
--   duplica e nunca reescreve um mês já congelado.
--
-- DEPENDE DE: 20260730120000 (Etapa 4) e 20260730130000 (histórico/crédito)
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
    SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='establishment_monthly_goals'
  ) THEN
    v_missing := v_missing || ' establishment_monthly_goals (rode a migration do histórico antes)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='count_establishment_valid_payments'
  ) THEN
    v_missing := v_missing || ' count_establishment_valid_payments() (rode a Etapa 4 antes)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='monthly_goal_sp_month_date'
  ) THEN
    v_missing := v_missing || ' monthly_goal_sp_month_date()';
  END IF;

  IF v_missing <> '' THEN
    RAISE EXCEPTION 'Migration Meta Mensal (auto-fechamento) abortada. Faltando:%', v_missing;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1) Congela o mês de UM estabelecimento, se ainda não estiver congelado.
--    Barata: sai na primeira linha quando o mês já existe.
--    Nunca congela mês em andamento — o percentual ainda pode subir.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_establishment_month_closed(
  p_establishment_id uuid,
  p_month date DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month      date;
  v_count      integer := 0;
  v_global     numeric := 0;
  v_plan_cents integer := 0;
  v_percent    integer := 0;
  v_discount   integer := 0;
  v_status     text := 'closed';
  v_notes      text := NULL;
BEGIN
  IF p_establishment_id IS NULL THEN RETURN; END IF;

  v_month := date_trunc(
    'month',
    coalesce(p_month, (public.monthly_goal_sp_month_date() - interval '1 month')::date)
  )::date;

  -- Mês corrente (ou futuro) nunca é congelado.
  IF v_month >= public.monthly_goal_sp_month_date() THEN RETURN; END IF;

  -- Já congelado: nada a fazer. É o caminho normal — sai daqui quase sempre.
  IF EXISTS (
    SELECT 1 FROM public.establishment_monthly_goals g
    WHERE g.establishment_id = p_establishment_id AND g.reference_month = v_month
  ) THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.establishments e WHERE e.id = p_establishment_id) THEN
    RETURN;
  END IF;

  v_count := coalesce(public.count_establishment_valid_payments(p_establishment_id, v_month), 0);

  SELECT coalesce(l.mercadopago_billing_amount, 0) INTO v_global
  FROM public.admin_billing_links l WHERE l.id = 'global';

  SELECT round(
    CASE WHEN coalesce(e.mercadopago_billing_amount, 0) > 0
         THEN e.mercadopago_billing_amount
         ELSE coalesce(v_global, 0) END * 100
  )::int
  INTO v_plan_cents
  FROM public.establishments e WHERE e.id = p_establishment_id;

  v_plan_cents := coalesce(v_plan_cents, 0);

  -- Faixas fechadas — mesma regra de src/utils/monthlyGoal.ts e do fechamento em lote.
  v_percent := CASE
    WHEN v_count >= 160 THEN 100
    WHEN v_count >= 120 THEN 75
    WHEN v_count >=  80 THEN 50
    WHEN v_count >=  40 THEN 25
    ELSE 0
  END;

  v_discount := least(v_plan_cents, greatest(0, round(v_plan_cents::numeric * v_percent / 100)::int));

  -- Conflito com mensalidade grátis por indicação: o maior benefício vence.
  IF v_percent < 100 AND EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='partner_free_monthly_history'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM public.partner_free_monthly_history h
      WHERE h.partner_establishment_id = p_establishment_id
        AND date_trunc('month', h.reference_month)::date = v_month
        AND h.status = 'applied'
    ) THEN
      v_status := 'superseded';
      v_notes := 'Mensalidade grátis por indicação já aplicada neste mês (benefício maior).';
    END IF;
  END IF;

  INSERT INTO public.establishment_monthly_goals (
    establishment_id, reference_month, valid_payments_count, goal_target,
    percent_final, plan_amount_cents, discount_cents, final_amount_cents,
    status, source, notes
  ) VALUES (
    p_establishment_id, v_month, v_count, 160,
    v_percent, v_plan_cents, v_discount, (v_plan_cents - v_discount),
    v_status, 'admin_mp_commissions', v_notes
  )
  ON CONFLICT (establishment_id, reference_month) DO NOTHING;
END;
$$;

COMMENT ON FUNCTION public.ensure_establishment_month_closed(uuid, date) IS
  'Congela o resultado da Meta Mensal de um estabelecimento. Idempotente. Não altera cobrança.';

-- ---------------------------------------------------------------------------
-- 2) Crédito disponível — agora fecha o mês anterior sozinho antes de olhar.
--    Regra: vale APENAS o mês imediatamente anterior. Se lá ele fez 0%,
--    não há crédito — não volta para meses mais antigos.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_monthly_goal_credit(p_establishment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_month    date;
  v_row      public.establishment_monthly_goals%ROWTYPE;
BEGIN
  IF p_establishment_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_establishment_id', 'available', false);
  END IF;

  SELECT e.owner_id INTO v_owner_id
  FROM public.establishments e WHERE e.id = p_establishment_id;

  IF NOT public.is_admin_user() AND (v_owner_id IS NULL OR v_owner_id <> auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden', 'available', false);
  END IF;

  v_month := (public.monthly_goal_sp_month_date() - interval '1 month')::date;

  -- Fechamento automático: se o mês anterior ainda não foi congelado, congela agora.
  PERFORM public.ensure_establishment_month_closed(p_establishment_id, v_month);

  SELECT g.* INTO v_row
  FROM public.establishment_monthly_goals g
  WHERE g.establishment_id = p_establishment_id
    AND g.reference_month = v_month
    AND g.percent_final > 0
    AND (
      g.status = 'closed'
      OR (
        g.status = 'applied'
        AND NOT EXISTS (
          SELECT 1 FROM public.establishment_billing_payments b
          WHERE b.id = g.applied_charge_id AND b.status = 'paid'
        )
      )
    );

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'available', false, 'reference_month', v_month);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'available', true,
    'goal_id', v_row.id,
    'reference_month', v_row.reference_month,
    'percent', v_row.percent_final,
    'valid_payments', v_row.valid_payments_count
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 3) Consumo — mesma ancoragem no mês anterior. Exclusiva do servidor.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_monthly_goal_credit(
  p_establishment_id uuid,
  p_billing_payment_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month date;
  v_row   public.establishment_monthly_goals%ROWTYPE;
BEGIN
  IF p_establishment_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_establishment_id', 'applied', false);
  END IF;

  v_month := (public.monthly_goal_sp_month_date() - interval '1 month')::date;

  PERFORM public.ensure_establishment_month_closed(p_establishment_id, v_month);

  -- FOR UPDATE evita consumo duplo em dois cliques simultâneos.
  SELECT g.* INTO v_row
  FROM public.establishment_monthly_goals g
  WHERE g.establishment_id = p_establishment_id
    AND g.reference_month = v_month
    AND g.percent_final > 0
    AND (
      g.status = 'closed'
      OR (
        g.status = 'applied'
        AND NOT EXISTS (
          SELECT 1 FROM public.establishment_billing_payments b
          WHERE b.id = g.applied_charge_id AND b.status = 'paid'
        )
      )
    )
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'applied', false, 'reason', 'no_credit');
  END IF;

  UPDATE public.establishment_monthly_goals
  SET status = 'applied',
      applied_at = now(),
      applied_charge_id = p_billing_payment_id,
      updated_at = now()
  WHERE id = v_row.id;

  RETURN jsonb_build_object(
    'ok', true,
    'applied', true,
    'goal_id', v_row.id,
    'reference_month', v_row.reference_month,
    'percent', v_row.percent_final
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 4) Grants
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.get_monthly_goal_credit(uuid) TO authenticated;

-- ensure_...: chamada por dentro das funções acima. Liberada para authenticated
-- porque é inofensiva (só congela o passado e é idempotente), mas o caminho
-- normal nunca a chama direto.
GRANT EXECUTE ON FUNCTION public.ensure_establishment_month_closed(uuid, date) TO authenticated;

-- consume_...: SOMENTE servidor. Impede forjar desconto pelo navegador.
REVOKE ALL ON FUNCTION public.consume_monthly_goal_credit(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_monthly_goal_credit(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.consume_monthly_goal_credit(uuid, uuid) TO service_role;

COMMIT;

-- =============================================================================
-- ROLLBACK (volta ao fechamento manual, sem perder histórico):
--
-- DROP FUNCTION IF EXISTS public.ensure_establishment_month_closed(uuid, date);
--   -> as funções de crédito passariam a falhar; reaplique a versão anterior
--      de get/consume vinda de 20260730130000 antes de remover esta.
--
-- Nada precisa ser desfeito na tabela: os meses já congelados continuam válidos.
-- =============================================================================
