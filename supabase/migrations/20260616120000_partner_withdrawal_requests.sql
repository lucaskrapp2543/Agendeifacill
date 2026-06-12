-- Fase 5: solicitações de saque manual dos parceiros (Indique e Ganhe).
-- Seguro para produção: só cria tabela nova + funções novas. Não altera billing/MP/login.
-- Rode ANTES: 20260616120000_partner_withdrawal_requests_VERIFY.sql

BEGIN;

-- ---------------------------------------------------------------------------
-- 0) Preflight — aborta sem alterar nada se faltar dependência crítica
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_missing text := '';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'partner_referrals'
  ) THEN
    v_missing := v_missing || ' partner_referrals';
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
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_admin_user'
  ) THEN
    v_missing := v_missing || ' is_admin_user()';
  END IF;

  IF v_missing <> '' THEN
    RAISE EXCEPTION 'Migration Fase 5 abortada. Dependências faltando:%', v_missing;
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

-- ---------------------------------------------------------------------------
-- 1) Tabela nova (isolada — não mexe em establishments, billing, MP)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partner_withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  paid_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_withdrawal_requests_partner
  ON public.partner_withdrawal_requests (partner_establishment_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_partner_withdrawal_requests_status
  ON public.partner_withdrawal_requests (status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_partner_withdrawal_requests_updated_at'
  ) THEN
    CREATE TRIGGER trg_partner_withdrawal_requests_updated_at
    BEFORE UPDATE ON public.partner_withdrawal_requests
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

ALTER TABLE public.partner_withdrawal_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partners can read own withdrawal requests" ON public.partner_withdrawal_requests;
CREATE POLICY "Partners can read own withdrawal requests"
  ON public.partner_withdrawal_requests
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.establishments e
      WHERE e.id = partner_withdrawal_requests.partner_establishment_id
        AND e.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admin can read all partner withdrawal requests" ON public.partner_withdrawal_requests;
CREATE POLICY "Admin can read all partner withdrawal requests"
  ON public.partner_withdrawal_requests
  FOR SELECT TO authenticated
  USING (public.is_admin_user());

GRANT SELECT ON public.partner_withdrawal_requests TO authenticated;
GRANT ALL ON public.partner_withdrawal_requests TO service_role;

-- ---------------------------------------------------------------------------
-- 2) Cálculo interno (não exposto ao frontend — chamado só pela RPC de saque)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compute_partner_withdrawal_amount_cents(p_partner_establishment_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH sp_today AS (
    SELECT (timezone('America/Sao_Paulo', now()))::date AS d
  )
  SELECT GREATEST(0, count(*)::integer - 3) * 800
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
-- 3) RPCs (SECURITY DEFINER + search_path fixo + checagem de auth)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_partner_withdrawal(p_partner_establishment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_amount_cents integer;
  v_sp_day integer;
  v_existing_id uuid;
  v_row public.partner_withdrawal_requests%ROWTYPE;
BEGIN
  IF p_partner_establishment_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_partner_establishment_id');
  END IF;

  SELECT e.owner_id INTO v_owner_id
  FROM public.establishments e
  WHERE e.id = p_partner_establishment_id;

  IF v_owner_id IS NULL OR v_owner_id <> auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  v_sp_day := extract(day FROM (timezone('America/Sao_Paulo', now()))::date);
  IF v_sp_day <> 5 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'withdrawal_only_day_5',
      'message', 'Os saques ficam disponíveis todo dia 5.'
    );
  END IF;

  SELECT id INTO v_existing_id
  FROM public.partner_withdrawal_requests
  WHERE partner_establishment_id = p_partner_establishment_id
    AND status IN ('pending', 'paid')
    AND date_trunc('month', timezone('America/Sao_Paulo', requested_at))
      = date_trunc('month', timezone('America/Sao_Paulo', now()))
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'withdrawal_already_requested_this_month',
      'message', 'Você já possui uma solicitação de saque neste mês.'
    );
  END IF;

  v_amount_cents := public.compute_partner_withdrawal_amount_cents(p_partner_establishment_id);
  IF coalesce(v_amount_cents, 0) <= 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'zero_amount',
      'message', 'Não há saldo disponível para saque no momento.'
    );
  END IF;

  INSERT INTO public.partner_withdrawal_requests (
    partner_establishment_id, amount_cents, status, requested_at
  )
  VALUES (p_partner_establishment_id, v_amount_cents, 'pending', now())
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'ok', true,
    'request', jsonb_build_object(
      'id', v_row.id,
      'partner_establishment_id', v_row.partner_establishment_id,
      'amount_cents', v_row.amount_cents,
      'status', v_row.status,
      'requested_at', v_row.requested_at
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.list_partner_withdrawal_requests(p_partner_establishment_id uuid)
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
        'id', r.id,
        'partner_establishment_id', r.partner_establishment_id,
        'amount_cents', r.amount_cents,
        'status', r.status,
        'requested_at', r.requested_at,
        'paid_at', r.paid_at,
        'paid_by', r.paid_by,
        'notes', r.notes
      )
      ORDER BY r.requested_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_items
  FROM public.partner_withdrawal_requests r
  WHERE r.partner_establishment_id = p_partner_establishment_id;

  RETURN jsonb_build_object('ok', true, 'items', v_items);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_partner_withdrawal_request(
  p_request_id uuid,
  p_action text,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.partner_withdrawal_requests%ROWTYPE;
  v_action text := lower(trim(coalesce(p_action, '')));
BEGIN
  IF NOT public.is_admin_user() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF p_request_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_request_id');
  END IF;

  SELECT * INTO v_row
  FROM public.partner_withdrawal_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_row.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_pending', 'message', 'Esta solicitação já foi finalizada.');
  END IF;

  IF v_action = 'paid' THEN
    UPDATE public.partner_withdrawal_requests
    SET status = 'paid', paid_at = now(), paid_by = auth.uid(),
        notes = nullif(trim(coalesce(p_notes, notes, '')), '')
    WHERE id = p_request_id
    RETURNING * INTO v_row;
  ELSIF v_action = 'cancel' THEN
    UPDATE public.partner_withdrawal_requests
    SET status = 'cancelled',
        notes = nullif(trim(coalesce(p_notes, notes, '')), '')
    WHERE id = p_request_id
    RETURNING * INTO v_row;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_action');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'request', jsonb_build_object(
      'id', v_row.id,
      'amount_cents', v_row.amount_cents,
      'status', v_row.status,
      'requested_at', v_row.requested_at,
      'paid_at', v_row.paid_at,
      'notes', v_row.notes
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_partner_withdrawal(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_partner_withdrawal_requests(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_partner_withdrawal_request(uuid, text, text) TO authenticated;

COMMIT;
