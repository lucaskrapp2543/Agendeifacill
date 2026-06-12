-- Fase 7: histórico de mensalidade grátis por indicações (controle manual — sem billing automático).
-- Seguro para produção: só cria tabela nova + funções novas. Não altera billing/MP/login.
-- Rode ANTES: 20260617120000_partner_free_monthly_history_VERIFY.sql

BEGIN;

-- ---------------------------------------------------------------------------
-- 0) Preflight — aborta sem alterar nada se faltar dependência crítica
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_missing text := '';
  v_existing text := '';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'partner_referrals'
  ) THEN
    v_missing := v_missing || ' partner_referrals';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'establishments'
  ) THEN
    v_missing := v_missing || ' establishments';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'establishments' AND column_name = 'id'
  ) THEN
    v_missing := v_missing || ' establishments.id';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'establishments' AND column_name = 'owner_id'
  ) THEN
    v_missing := v_missing || ' establishments.owner_id';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'establishments' AND column_name = 'payment_status'
  ) THEN
    v_missing := v_missing || ' establishments.payment_status';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'establishments' AND column_name = 'payment_due_date'
  ) THEN
    v_missing := v_missing || ' establishments.payment_due_date';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'establishments' AND column_name = 'payment_paid_at'
  ) THEN
    v_missing := v_missing || ' establishments.payment_paid_at';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'establishments' AND column_name = 'is_blocked'
  ) THEN
    v_missing := v_missing || ' establishments.is_blocked';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'establishments' AND column_name = 'is_deleted'
  ) THEN
    v_missing := v_missing || ' establishments.is_deleted';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'partner_referrals' AND column_name = 'status'
  ) THEN
    v_missing := v_missing || ' partner_referrals.status';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'partner_referrals' AND column_name = 'selected_plan'
  ) THEN
    v_missing := v_missing || ' partner_referrals.selected_plan';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_admin_user'
  ) THEN
    v_missing := v_missing || ' is_admin_user()';
  END IF;

  IF v_missing <> '' THEN
    RAISE EXCEPTION 'Migration Fase 7 abortada. Dependências faltando:%', v_missing;
  END IF;

  -- Objetos desta migration: informar se já existem (re-execução idempotente)
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'partner_free_monthly_history'
  ) THEN
    v_existing := v_existing || ' partner_free_monthly_history';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'count_partner_active_referrals'
  ) THEN
    v_existing := v_existing || ' count_partner_active_referrals()';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'list_partner_free_monthly_history'
  ) THEN
    v_existing := v_existing || ' list_partner_free_monthly_history()';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'admin_upsert_partner_free_monthly'
  ) THEN
    v_existing := v_existing || ' admin_upsert_partner_free_monthly()';
  END IF;

  IF v_existing <> '' THEN
    RAISE NOTICE 'Fase 7: objetos já existentes (re-execução segura — IF NOT EXISTS / CREATE OR REPLACE):%', v_existing;
  END IF;
END $$;

-- Garante trigger helper (mesmo corpo usado em outras migrations — idempotente)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.count_partner_active_referrals(p_partner_establishment_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH sp_today AS (
    SELECT (timezone('America/Sao_Paulo', now()))::date AS d
  )
  SELECT count(*)::integer
  FROM public.partner_referrals pr
  INNER JOIN public.establishments e ON e.id = pr.referred_establishment_id
  CROSS JOIN sp_today t
  WHERE pr.partner_establishment_id = p_partner_establishment_id
    AND lower(coalesce(pr.status::text, '')) = 'active'
    AND lower(coalesce(pr.selected_plan::text, '')) = 'diamante'
    AND coalesce(e.is_blocked, false) = false
    AND coalesce(e.is_deleted, false) = false
    AND lower(coalesce(e.payment_status::text, 'unpaid')) <> 'expired'
    AND NOT (
      lower(coalesce(e.payment_status::text, 'unpaid')) = 'unpaid'
      AND e.payment_paid_at IS NULL
      AND (
        e.payment_due_date IS NULL
        OR (timezone('America/Sao_Paulo', e.payment_due_date))::date < t.d
      )
    )
    AND (
      (
        e.payment_due_date IS NOT NULL
        AND (timezone('America/Sao_Paulo', e.payment_due_date))::date >= t.d
      )
      OR lower(coalesce(e.payment_status::text, '')) = 'paid'
    )
    AND lower(coalesce(e.payment_status::text, 'unpaid')) <> 'unpaid';
$$;

-- ---------------------------------------------------------------------------
-- 1) Tabela nova (isolada — não mexe em billing, MP ou vencimentos)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partner_free_monthly_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  reference_month date NOT NULL,
  active_referrals_count integer NOT NULL DEFAULT 0 CHECK (active_referrals_count >= 0),
  status text NOT NULL CHECK (status IN ('eligible', 'applied', 'lost')),
  applied_at timestamptz,
  applied_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT partner_free_monthly_history_month_unique UNIQUE (partner_establishment_id, reference_month)
);

CREATE INDEX IF NOT EXISTS idx_partner_free_monthly_history_partner
  ON public.partner_free_monthly_history (partner_establishment_id, reference_month DESC);

COMMENT ON TABLE public.partner_free_monthly_history IS
  'Histórico manual de mensalidade grátis (Indique e Ganhe). Não altera cobrança MP/billing.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_partner_free_monthly_history_updated_at'
  ) THEN
    CREATE TRIGGER trg_partner_free_monthly_history_updated_at
    BEFORE UPDATE ON public.partner_free_monthly_history
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

ALTER TABLE public.partner_free_monthly_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partners can read own free monthly history" ON public.partner_free_monthly_history;
CREATE POLICY "Partners can read own free monthly history"
  ON public.partner_free_monthly_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.establishments e
      WHERE e.id = partner_free_monthly_history.partner_establishment_id
        AND e.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admin can read all partner free monthly history" ON public.partner_free_monthly_history;
CREATE POLICY "Admin can read all partner free monthly history"
  ON public.partner_free_monthly_history
  FOR SELECT TO authenticated
  USING (public.is_admin_user());

GRANT SELECT ON public.partner_free_monthly_history TO authenticated;
GRANT ALL ON public.partner_free_monthly_history TO service_role;

-- ---------------------------------------------------------------------------
-- 2) Funções (count reutiliza mesma lógica de indicado ativo da Fase 5)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.partner_referral_sp_month_date()
RETURNS date
LANGUAGE sql
STABLE
AS $$
  SELECT date_trunc('month', timezone('America/Sao_Paulo', now()))::date;
$$;

CREATE OR REPLACE FUNCTION public.list_partner_free_monthly_history(p_partner_establishment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_items jsonb;
BEGIN
  IF p_partner_establishment_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_partner_establishment_id', 'items', '[]'::jsonb);
  END IF;

  SELECT e.owner_id INTO v_owner_id
  FROM public.establishments e
  WHERE e.id = p_partner_establishment_id;

  IF NOT public.is_admin_user() AND (v_owner_id IS NULL OR v_owner_id <> auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden', 'items', '[]'::jsonb);
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', h.id,
        'partner_establishment_id', h.partner_establishment_id,
        'reference_month', h.reference_month,
        'active_referrals_count', h.active_referrals_count,
        'status', h.status,
        'applied_at', h.applied_at,
        'applied_by', h.applied_by,
        'notes', h.notes,
        'created_at', h.created_at
      )
      ORDER BY h.reference_month DESC
    ),
    '[]'::jsonb
  )
  INTO v_items
  FROM public.partner_free_monthly_history h
  WHERE h.partner_establishment_id = p_partner_establishment_id;

  RETURN jsonb_build_object('ok', true, 'items', v_items);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_upsert_partner_free_monthly(
  p_partner_establishment_id uuid,
  p_status text,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text := lower(trim(coalesce(p_status, '')));
  v_active integer;
  v_month date := public.partner_referral_sp_month_date();
  v_row public.partner_free_monthly_history%ROWTYPE;
BEGIN
  IF NOT public.is_admin_user() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF p_partner_establishment_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_partner_establishment_id');
  END IF;

  IF v_status NOT IN ('eligible', 'applied', 'lost') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.establishments e WHERE e.id = p_partner_establishment_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'partner_not_found');
  END IF;

  v_active := public.count_partner_active_referrals(p_partner_establishment_id);

  IF v_status = 'applied' AND coalesce(v_active, 0) < 3 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'not_eligible',
      'message', 'Parceiro precisa de 3 indicados ativos para aplicar mensalidade grátis.',
      'active_referrals_count', coalesce(v_active, 0)
    );
  END IF;

  INSERT INTO public.partner_free_monthly_history (
    partner_establishment_id,
    reference_month,
    active_referrals_count,
    status,
    applied_at,
    applied_by,
    notes
  )
  VALUES (
    p_partner_establishment_id,
    v_month,
    coalesce(v_active, 0),
    v_status,
    CASE WHEN v_status = 'applied' THEN now() ELSE NULL END,
    CASE WHEN v_status = 'applied' THEN auth.uid() ELSE NULL END,
    nullif(trim(coalesce(p_notes, '')), '')
  )
  ON CONFLICT (partner_establishment_id, reference_month)
  DO UPDATE SET
    active_referrals_count = EXCLUDED.active_referrals_count,
    status = EXCLUDED.status,
    applied_at = CASE WHEN EXCLUDED.status = 'applied' THEN now() ELSE partner_free_monthly_history.applied_at END,
    applied_by = CASE WHEN EXCLUDED.status = 'applied' THEN auth.uid() ELSE partner_free_monthly_history.applied_by END,
    notes = coalesce(EXCLUDED.notes, partner_free_monthly_history.notes),
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'ok', true,
    'record', jsonb_build_object(
      'id', v_row.id,
      'reference_month', v_row.reference_month,
      'active_referrals_count', v_row.active_referrals_count,
      'status', v_row.status,
      'applied_at', v_row.applied_at,
      'notes', v_row.notes
    )
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 3) Grants (count_partner_active_referrals: uso interno via RPC admin)
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.list_partner_free_monthly_history(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_partner_free_monthly(uuid, text, text) TO authenticated;

COMMIT;
