-- =============================================================================
-- 🏆 META MENSAL — Etapa 5: histórico mensal + fechamento idempotente
-- -----------------------------------------------------------------------------
-- MOTIVO
--   Congelar o resultado do mês (contagem, percentual, desconto) num registro
--   histórico auditável. Durante o mês nada é gravado: o progresso é calculado
--   ao vivo. A linha só nasce no fechamento.
--
-- IMPACTO
--   Cria UMA tabela nova + 5 funções. NÃO altera nenhuma tabela existente.
--   Rodar esta migration NÃO cria, não altera e não aplica nenhuma cobrança.
--   Não toca em Mercado Pago, preapproval, token, webhook ou WhatsApp.
--
--   As funções de crédito (itens 4 e 5) apenas LEEM e MARCAM o crédito como
--   usado. Quem calcula e cobra o valor com desconto é o servidor, e SOMENTE
--   no caminho PIX (pagamento avulso). A assinatura no cartão (preapproval)
--   permanece intocada: alterar o valor dela é tecnicamente impossível sem
--   recriar a assinatura, o que traria risco de cobrança dupla.
--
-- IDEMPOTÊNCIA
--   UNIQUE (establishment_id, reference_month) + ON CONFLICT DO NOTHING.
--   Rodar o fechamento 10x produz exatamente o mesmo resultado que rodar 1x:
--   nunca duplica, nunca altera um mês já fechado, nunca concede 2x.
--
-- CONFLITO DE BENEFÍCIO
--   Se o estabelecimento já tem mensalidade grátis por indicação no mesmo mês,
--   vence o MAIOR benefício (decisão do usuário). Como a indicação equivale a
--   100%, ela vence salvo empate; a Meta fica registrada como 'superseded',
--   preservando o histórico e o motivo.
--
-- ANTES DE RODAR: execute 20260730130000_establishment_monthly_goals_history_VERIFY.sql
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0) Preflight — aborta sem alterar nada se faltar dependência
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_missing text := '';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='admin_mp_commissions') THEN
    v_missing := v_missing || ' admin_mp_commissions';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='establishments') THEN
    v_missing := v_missing || ' establishments';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='is_admin_user'
  ) THEN
    v_missing := v_missing || ' is_admin_user()';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='monthly_goal_sp_month_date'
  ) THEN
    v_missing := v_missing || ' monthly_goal_sp_month_date() (rode a migration da Etapa 4 antes)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='establishment_billing_payments'
  ) THEN
    v_missing := v_missing || ' establishment_billing_payments';
  END IF;

  IF v_missing <> '' THEN
    RAISE EXCEPTION 'Migration Meta Mensal (histórico) abortada. Dependências faltando:%', v_missing;
  END IF;
END $$;

-- Trigger helper (idempotente — mesmo corpo usado em outras migrations)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 1) Tabela de histórico (isolada — não referencia cobrança)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.establishment_monthly_goals (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id      uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  reference_month       date NOT NULL,
  valid_payments_count  integer NOT NULL DEFAULT 0 CHECK (valid_payments_count >= 0),
  goal_target           integer NOT NULL DEFAULT 160 CHECK (goal_target > 0),
  percent_final         integer NOT NULL DEFAULT 0 CHECK (percent_final BETWEEN 0 AND 100),
  plan_amount_cents     integer NOT NULL DEFAULT 0 CHECK (plan_amount_cents >= 0),
  discount_cents        integer NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
  final_amount_cents    integer NOT NULL DEFAULT 0 CHECK (final_amount_cents >= 0),
  status                text    NOT NULL DEFAULT 'closed'
    CHECK (status IN ('closed', 'awaiting', 'applied', 'cancelled', 'expired', 'superseded')),
  -- Aplicação do crédito: preenchidas por consume_monthly_goal_credit().
  -- applied_charge_id aponta para establishment_billing_payments(id) — se esse
  -- PIX não for pago, o crédito volta a ficar disponível (ver item 4).
  applied_at            timestamptz,
  applied_by            uuid,
  applied_charge_id     uuid,
  source                text NOT NULL DEFAULT 'admin_mp_commissions',
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT establishment_monthly_goals_month_unique UNIQUE (establishment_id, reference_month),
  -- Coerência aritmética garantida pelo banco
  CONSTRAINT establishment_monthly_goals_amount_check
    CHECK (discount_cents + final_amount_cents = plan_amount_cents)
);

CREATE INDEX IF NOT EXISTS idx_establishment_monthly_goals_est
  ON public.establishment_monthly_goals (establishment_id, reference_month DESC);

CREATE INDEX IF NOT EXISTS idx_establishment_monthly_goals_month
  ON public.establishment_monthly_goals (reference_month DESC);

COMMENT ON TABLE public.establishment_monthly_goals IS
  'Histórico mensal da Meta Mensal (desconto por pagamentos online). Registro/auditoria apenas — NÃO altera cobrança MP/billing.';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_establishment_monthly_goals_updated_at') THEN
    CREATE TRIGGER trg_establishment_monthly_goals_updated_at
    BEFORE UPDATE ON public.establishment_monthly_goals
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

ALTER TABLE public.establishment_monthly_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner reads own monthly goals" ON public.establishment_monthly_goals;
CREATE POLICY "Owner reads own monthly goals"
  ON public.establishment_monthly_goals
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.establishments e
      WHERE e.id = establishment_monthly_goals.establishment_id
        AND e.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admin reads all monthly goals" ON public.establishment_monthly_goals;
CREATE POLICY "Admin reads all monthly goals"
  ON public.establishment_monthly_goals
  FOR SELECT TO authenticated
  USING (public.is_admin_user());

GRANT SELECT ON public.establishment_monthly_goals TO authenticated;
GRANT ALL ON public.establishment_monthly_goals TO service_role;

-- ---------------------------------------------------------------------------
-- 2) Fechamento do mês — IDEMPOTENTE
--    Percorre todos os estabelecimentos ativos, congela o resultado e grava.
--    ON CONFLICT DO NOTHING: mês já fechado NUNCA é alterado.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_close_monthly_goals(p_month date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month        date := coalesce(p_month, (public.monthly_goal_sp_month_date() - interval '1 month')::date);
  v_start        timestamptz;
  v_end          timestamptz;
  v_global       numeric := 0;
  v_inserted     integer := 0;
  v_skipped      integer := 0;
  v_superseded   integer := 0;
  v_has_partner  boolean := false;
BEGIN
  IF NOT public.is_admin_user() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  v_month := date_trunc('month', v_month)::date;
  v_start := v_month::timestamptz;
  v_end   := (v_month + interval '1 month')::timestamptz;

  -- Não fechar mês que ainda está em andamento (o percentual poderia subir).
  IF v_month >= public.monthly_goal_sp_month_date() THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'month_still_open',
      'message', 'Só é possível fechar um mês que já terminou.',
      'reference_month', v_month
    );
  END IF;

  SELECT coalesce(l.mercadopago_billing_amount, 0) INTO v_global
  FROM public.admin_billing_links l WHERE l.id = 'global';

  SELECT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='partner_free_monthly_history'
  ) INTO v_has_partner;

  WITH contagem AS (
    SELECT c.establishment_id, count(*)::int AS pagamentos
    FROM public.admin_mp_commissions c
    WHERE c.status = 'paid' AND c.paid_at >= v_start AND c.paid_at < v_end
    GROUP BY c.establishment_id
  ),
  base AS (
    SELECT
      e.id AS establishment_id,
      coalesce(ct.pagamentos, 0) AS pagamentos,
      -- FAIXAS FECHADAS (mesma regra do frontend em src/utils/monthlyGoal.ts):
      -- só sobe de degrau ao bater o número cheio; não existe valor intermediário.
      CASE
        WHEN coalesce(ct.pagamentos, 0) >= 160 THEN 100
        WHEN coalesce(ct.pagamentos, 0) >= 120 THEN 75
        WHEN coalesce(ct.pagamentos, 0) >=  80 THEN 50
        WHEN coalesce(ct.pagamentos, 0) >=  40 THEN 25
        ELSE 0
      END AS percentual,
      round(
        CASE WHEN coalesce(e.mercadopago_billing_amount, 0) > 0
             THEN e.mercadopago_billing_amount
             ELSE coalesce(v_global, 0) END * 100
      )::int AS plano_cents
    FROM public.establishments e
    LEFT JOIN contagem ct ON ct.establishment_id = e.id
    WHERE coalesce(e.is_deleted, false) = false
  ),
  calc AS (
    SELECT
      b.*,
      least(b.plano_cents, greatest(0, round(b.plano_cents::numeric * b.percentual / 100)::int)) AS desconto_cents
    FROM base b
  ),
  final AS (
    SELECT
      c.*,
      (c.plano_cents - c.desconto_cents) AS final_cents,
      -- Conflito: indicação (mensalidade grátis = 100%) vence salvo empate
      CASE
        WHEN v_has_partner AND c.percentual < 100 AND EXISTS (
          SELECT 1 FROM public.partner_free_monthly_history h
          WHERE h.partner_establishment_id = c.establishment_id
            AND date_trunc('month', h.reference_month)::date = v_month
            AND h.status = 'applied'
        ) THEN 'superseded'
        ELSE 'closed'
      END AS status_final
    FROM calc c
  )
  INSERT INTO public.establishment_monthly_goals (
    establishment_id, reference_month, valid_payments_count, goal_target,
    percent_final, plan_amount_cents, discount_cents, final_amount_cents,
    status, source, notes
  )
  SELECT
    f.establishment_id, v_month, f.pagamentos, 160,
    f.percentual, f.plano_cents, f.desconto_cents, f.final_cents,
    f.status_final, 'admin_mp_commissions',
    CASE WHEN f.status_final = 'superseded'
         THEN 'Mensalidade grátis por indicação já aplicada neste mês (benefício maior).'
         ELSE NULL END
  FROM final f
  ON CONFLICT (establishment_id, reference_month) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  SELECT count(*)::int INTO v_superseded
  FROM public.establishment_monthly_goals g
  WHERE g.reference_month = v_month AND g.status = 'superseded';

  SELECT count(*)::int - v_inserted INTO v_skipped
  FROM public.establishment_monthly_goals g
  WHERE g.reference_month = v_month;

  RETURN jsonb_build_object(
    'ok', true,
    'reference_month', v_month,
    'inserted', v_inserted,
    'already_closed', greatest(0, v_skipped),
    'superseded_by_referral', v_superseded,
    'note', 'Somente registro. Nenhuma cobranca foi criada ou alterada.'
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 3) Histórico de um estabelecimento (dono ou admin)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_establishment_monthly_goal_history(
  p_establishment_id uuid,
  p_limit integer DEFAULT 12
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_items    jsonb;
BEGIN
  IF p_establishment_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_establishment_id', 'items', '[]'::jsonb);
  END IF;

  SELECT e.owner_id INTO v_owner_id
  FROM public.establishments e WHERE e.id = p_establishment_id;

  IF NOT public.is_admin_user() AND (v_owner_id IS NULL OR v_owner_id <> auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden', 'items', '[]'::jsonb);
  END IF;

  SELECT coalesce(jsonb_agg(item ORDER BY item->>'reference_month' DESC), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT jsonb_build_object(
      'reference_month', g.reference_month,
      'valid_payments_count', g.valid_payments_count,
      'goal_target', g.goal_target,
      'percent_final', g.percent_final,
      'plan_amount_cents', g.plan_amount_cents,
      'discount_cents', g.discount_cents,
      'final_amount_cents', g.final_amount_cents,
      'status', g.status,
      'notes', g.notes,
      'created_at', g.created_at
    ) AS item
    FROM public.establishment_monthly_goals g
    WHERE g.establishment_id = p_establishment_id
    ORDER BY g.reference_month DESC
    LIMIT greatest(1, least(60, coalesce(p_limit, 12)))
  ) t;

  RETURN jsonb_build_object('ok', true, 'items', v_items);
END;
$$;

-- ---------------------------------------------------------------------------
-- 4) CRÉDITO DISPONÍVEL (leitura) — para o modal mostrar "usar meu desconto"
--    Regra: vale só o ÚLTIMO mês fechado com percentual > 0 e ainda não usado.
--    Um crédito "usado" por um PIX que NÃO foi pago volta a ficar disponível,
--    senão o barbeiro perderia o desconto só por ter fechado o app.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_monthly_goal_credit(p_establishment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
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

  SELECT g.* INTO v_row
  FROM public.establishment_monthly_goals g
  WHERE g.establishment_id = p_establishment_id
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
  ORDER BY g.reference_month DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'available', false);
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
-- 5) CONSUMO DO CRÉDITO — exclusivo do servidor (service_role)
--    NUNCA exposto ao navegador: o desconto é decidido no backend, então
--    ninguém consegue forjar um valor menor pelo console.
--    Devolve o percentual aplicado; o cálculo do valor fica no servidor.
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
  v_row public.establishment_monthly_goals%ROWTYPE;
BEGIN
  IF p_establishment_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_establishment_id', 'applied', false);
  END IF;

  -- Trava a linha para evitar consumo duplo em cliques simultâneos
  SELECT g.* INTO v_row
  FROM public.establishment_monthly_goals g
  WHERE g.establishment_id = p_establishment_id
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
  ORDER BY g.reference_month DESC
  LIMIT 1
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
-- 6) Grants
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.admin_close_monthly_goals(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_establishment_monthly_goal_history(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_monthly_goal_credit(uuid) TO authenticated;

-- consume_monthly_goal_credit: SOMENTE servidor. O navegador não pode consumir
-- crédito diretamente — isso impede forjar desconto pelo console.
REVOKE ALL ON FUNCTION public.consume_monthly_goal_credit(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_monthly_goal_credit(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.consume_monthly_goal_credit(uuid, uuid) TO service_role;

COMMIT;

-- =============================================================================
-- ROLLBACK (remove só o que esta migration criou):
--
-- DROP FUNCTION IF EXISTS public.consume_monthly_goal_credit(uuid, uuid);
-- DROP FUNCTION IF EXISTS public.get_monthly_goal_credit(uuid);
-- DROP FUNCTION IF EXISTS public.list_establishment_monthly_goal_history(uuid, integer);
-- DROP FUNCTION IF EXISTS public.admin_close_monthly_goals(date);
-- DROP TABLE IF EXISTS public.establishment_monthly_goals;
--
-- ATENÇÃO: derrubar a tabela apaga o histórico de descontos já conquistados.
-- Se a intenção for só desligar o crédito, basta remover as 2 primeiras funções.
-- =============================================================================
