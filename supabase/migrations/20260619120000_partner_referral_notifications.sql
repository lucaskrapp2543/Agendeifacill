-- Fase 9: novidades do programa Indique e Ganhe (isolado — NÃO mexe no sino/notificações globais).
-- Rode ANTES: 20260619120000_partner_referral_notifications_VERIFY.sql

BEGIN;

-- ---------------------------------------------------------------------------
-- 0) Preflight
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_missing text := '';
  v_existing text := '';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'partner_referrals'
  ) THEN
    v_missing := v_missing || ' partner_referrals';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'establishments'
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
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_admin_user'
  ) THEN
    v_missing := v_missing || ' is_admin_user()';
  END IF;

  IF v_missing <> '' THEN
    RAISE EXCEPTION 'Migration Fase 9 abortada. Dependências faltando:%', v_missing;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'partner_referral_notifications'
  ) THEN
    v_existing := v_existing || ' partner_referral_notifications';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'sync_partner_referral_notifications'
  ) THEN
    v_existing := v_existing || ' sync_partner_referral_notifications()';
  END IF;

  IF v_existing <> '' THEN
    RAISE NOTICE 'Fase 9: objetos já existentes (re-execução segura):%', v_existing;
  END IF;
END $$;

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

CREATE OR REPLACE FUNCTION public.is_partner_referred_establishment_active_for_commission(
  p_referral_status text,
  p_selected_plan text,
  p_payment_status text,
  p_payment_due_date timestamptz,
  p_payment_paid_at timestamptz,
  p_is_blocked boolean,
  p_is_deleted boolean
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH sp_today AS (
    SELECT (timezone('America/Sao_Paulo', now()))::date AS d
  )
  SELECT
    lower(coalesce(p_referral_status, '')) = 'active'
    AND lower(coalesce(p_selected_plan, '')) = 'diamante'
    AND coalesce(p_is_blocked, false) = false
    AND coalesce(p_is_deleted, false) = false
    AND lower(coalesce(p_payment_status, 'unpaid')) <> 'expired'
    AND NOT (
      lower(coalesce(p_payment_status, 'unpaid')) = 'unpaid'
      AND p_payment_paid_at IS NULL
      AND (
        p_payment_due_date IS NULL
        OR (timezone('America/Sao_Paulo', p_payment_due_date))::date < (SELECT d FROM sp_today)
      )
    )
    AND (
      (
        p_payment_due_date IS NOT NULL
        AND (timezone('America/Sao_Paulo', p_payment_due_date))::date >= (SELECT d FROM sp_today)
      )
      OR lower(coalesce(p_payment_status, '')) = 'paid'
    )
    AND lower(coalesce(p_payment_status, 'unpaid')) <> 'unpaid';
$$;

-- ---------------------------------------------------------------------------
-- 1) Tabela isolada (sem FK para notifications globais)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partner_referral_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (
    notification_type IN ('new_referral', 'free_monthly_unlocked', 'started_earning', 'referral_inactive')
  ),
  dedupe_key text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT partner_referral_notifications_dedupe UNIQUE (partner_establishment_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_partner_referral_notifications_partner_created
  ON public.partner_referral_notifications (partner_establishment_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_partner_referral_notifications_unread
  ON public.partner_referral_notifications (partner_establishment_id, is_read)
  WHERE is_read = false;

COMMENT ON TABLE public.partner_referral_notifications IS
  'Novidades do programa Indique e Ganhe — isolado do sistema global de notificações.';

ALTER TABLE public.partner_referral_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partners can read own program notifications" ON public.partner_referral_notifications;
CREATE POLICY "Partners can read own program notifications"
  ON public.partner_referral_notifications
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.establishments e
      WHERE e.id = partner_referral_notifications.partner_establishment_id
        AND e.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admin can read all program notifications" ON public.partner_referral_notifications;
CREATE POLICY "Admin can read all program notifications"
  ON public.partner_referral_notifications
  FOR SELECT TO authenticated
  USING (public.is_admin_user());

GRANT SELECT ON public.partner_referral_notifications TO authenticated;
GRANT ALL ON public.partner_referral_notifications TO service_role;

-- ---------------------------------------------------------------------------
-- 2) RPCs — sync gera eventos sem duplicar (dedupe_key)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_partner_referral_notifications(p_partner_establishment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_active integer;
BEGIN
  IF p_partner_establishment_id IS NULL THEN
    RETURN;
  END IF;

  SELECT e.owner_id INTO v_owner_id
  FROM public.establishments e
  WHERE e.id = p_partner_establishment_id;

  IF NOT public.is_admin_user() AND (v_owner_id IS NULL OR v_owner_id <> auth.uid()) THEN
    RETURN;
  END IF;

  INSERT INTO public.partner_referral_notifications (
    partner_establishment_id, notification_type, dedupe_key, title, message, metadata
  )
  SELECT
    p_partner_establishment_id,
    'new_referral',
    'new_referral:' || pr.id::text,
    '🎉 Novo parceiro indicado',
    'Uma nova barbearia entrou usando seu cupom. Continue divulgando para desbloquear sua mensalidade grátis.',
    jsonb_build_object(
      'referral_id', pr.id,
      'referred_establishment_id', pr.referred_establishment_id
    )
  FROM public.partner_referrals pr
  WHERE pr.partner_establishment_id = p_partner_establishment_id
    AND coalesce(pr.linked_at, pr.created_at) >= (now() - interval '30 days')
  ON CONFLICT (partner_establishment_id, dedupe_key) DO NOTHING;

  v_active := public.count_partner_active_referrals(p_partner_establishment_id);

  IF coalesce(v_active, 0) >= 3 THEN
    INSERT INTO public.partner_referral_notifications (
      partner_establishment_id, notification_type, dedupe_key, title, message, metadata
    )
    VALUES (
      p_partner_establishment_id,
      'free_monthly_unlocked',
      'free_monthly_unlocked',
      '🔥 Mensalidade grátis desbloqueada',
      'Você atingiu 3 parceiros ativos e desbloqueou sua mensalidade grátis.',
      jsonb_build_object('active_count', v_active)
    )
    ON CONFLICT (partner_establishment_id, dedupe_key) DO NOTHING;
  END IF;

  IF coalesce(v_active, 0) >= 4 THEN
    INSERT INTO public.partner_referral_notifications (
      partner_establishment_id, notification_type, dedupe_key, title, message, metadata
    )
    VALUES (
      p_partner_establishment_id,
      'started_earning',
      'started_earning',
      '💰 Agora você começou a lucrar',
      'Agora você começou a lucrar com suas indicações. Cada parceiro ativo acima de 3 gera R$8/mês.',
      jsonb_build_object('active_count', v_active)
    )
    ON CONFLICT (partner_establishment_id, dedupe_key) DO NOTHING;
  END IF;

  INSERT INTO public.partner_referral_notifications (
    partner_establishment_id, notification_type, dedupe_key, title, message, metadata
  )
  SELECT
    p_partner_establishment_id,
    'referral_inactive',
    'referral_inactive:' || pr.id::text,
    '⚠️ Parceiro ficou inativo',
    'Um dos seus parceiros ficou inativo temporariamente. Você pode perder a mensalidade grátis se ficar abaixo de 3 ativos.',
    jsonb_build_object(
      'referral_id', pr.id,
      'referred_establishment_id', pr.referred_establishment_id
    )
  FROM public.partner_referrals pr
  INNER JOIN public.establishments e ON e.id = pr.referred_establishment_id
  WHERE pr.partner_establishment_id = p_partner_establishment_id
    AND NOT public.is_partner_referred_establishment_active_for_commission(
      pr.status::text,
      pr.selected_plan::text,
      e.payment_status::text,
      e.payment_due_date,
      e.payment_paid_at,
      e.is_blocked,
      e.is_deleted
    )
    AND EXISTS (
      SELECT 1 FROM public.partner_referral_notifications n
      WHERE n.partner_establishment_id = p_partner_establishment_id
        AND n.dedupe_key = 'new_referral:' || pr.id::text
    )
  ON CONFLICT (partner_establishment_id, dedupe_key) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_partner_referral_notifications(
  p_partner_establishment_id uuid,
  p_limit integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_items jsonb;
  v_limit integer := greatest(1, least(coalesce(p_limit, 20), 50));
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

  PERFORM public.sync_partner_referral_notifications(p_partner_establishment_id);

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', n.id,
        'notification_type', n.notification_type,
        'title', n.title,
        'message', n.message,
        'is_read', n.is_read,
        'metadata', n.metadata,
        'created_at', n.created_at
      )
      ORDER BY n.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_items
  FROM (
    SELECT *
    FROM public.partner_referral_notifications n
    WHERE n.partner_establishment_id = p_partner_establishment_id
    ORDER BY n.created_at DESC
    LIMIT v_limit
  ) n;

  RETURN jsonb_build_object(
    'ok', true,
    'items', v_items,
    'unread_count', (
      SELECT count(*)::integer
      FROM public.partner_referral_notifications n
      WHERE n.partner_establishment_id = p_partner_establishment_id
        AND n.is_read = false
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_partner_referral_notifications_read(
  p_partner_establishment_id uuid,
  p_notification_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_updated integer;
BEGIN
  IF p_partner_establishment_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_partner_establishment_id');
  END IF;

  SELECT e.owner_id INTO v_owner_id
  FROM public.establishments e
  WHERE e.id = p_partner_establishment_id;

  IF NOT public.is_admin_user() AND (v_owner_id IS NULL OR v_owner_id <> auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF p_notification_ids IS NOT NULL AND array_length(p_notification_ids, 1) > 0 THEN
    UPDATE public.partner_referral_notifications n
    SET is_read = true
    WHERE n.partner_establishment_id = p_partner_establishment_id
      AND n.id = ANY(p_notification_ids)
      AND n.is_read = false;
  ELSE
    UPDATE public.partner_referral_notifications n
    SET is_read = true
    WHERE n.partner_establishment_id = p_partner_establishment_id
      AND n.is_read = false;
  END IF;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'updated_count', coalesce(v_updated, 0));
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_partner_referral_notifications(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_partner_referral_notifications(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_partner_referral_notifications_read(uuid, uuid[]) TO authenticated;

COMMIT;
