-- Fase 3: dashboard de indicados para o parceiro (leitura agregada).

BEGIN;

CREATE OR REPLACE FUNCTION public.get_partner_referrals_dashboard(p_partner_establishment_id uuid)
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
    RETURN jsonb_build_object('ok', false, 'error', 'missing_partner_establishment_id');
  END IF;

  SELECT e.owner_id
  INTO v_owner_id
  FROM public.establishments e
  WHERE e.id = p_partner_establishment_id;

  IF v_owner_id IS NULL OR v_owner_id <> auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT coalesce(
    jsonb_agg(item ORDER BY sort_linked_at DESC NULLS LAST, sort_created_at DESC),
    '[]'::jsonb
  )
  INTO v_items
  FROM (
    SELECT
      jsonb_build_object(
        'referral_id', pr.id,
        'referred_establishment_id', pr.referred_establishment_id,
        'establishment_name', coalesce(nullif(btrim(e.name), ''), 'Estabelecimento indicado'),
        'linked_at', pr.linked_at,
        'created_at', pr.created_at,
        'selected_plan', pr.selected_plan,
        'referral_status', pr.status,
        'payment_status', coalesce(e.payment_status::text, 'unpaid'),
        'payment_due_date', e.payment_due_date,
        'payment_paid_at', e.payment_paid_at,
        'is_blocked', coalesce(e.is_blocked, false),
        'is_deleted', coalesce(e.is_deleted, false),
        'plan_prata_active', coalesce(e.plan_prata_active, false),
        'payment_alert_enabled', coalesce(e.payment_alert_enabled, false),
        'last_appointment_date', la.last_appointment_date,
        'last_appointment_time', la.last_appointment_time,
        'last_appointment_created_at', la.last_appointment_created_at
      ) AS item,
      coalesce(pr.linked_at, pr.created_at) AS sort_linked_at,
      pr.created_at AS sort_created_at
    FROM public.partner_referrals pr
    INNER JOIN public.establishments e ON e.id = pr.referred_establishment_id
    LEFT JOIN LATERAL (
      SELECT
        a.appointment_date::text AS last_appointment_date,
        a.appointment_time::text AS last_appointment_time,
        a.created_at AS last_appointment_created_at
      FROM public.appointments a
      WHERE a.establishment_id = e.id
        AND lower(coalesce(a.status::text, '')) NOT IN ('cancelled')
      ORDER BY a.appointment_date DESC NULLS LAST, a.appointment_time DESC NULLS LAST, a.created_at DESC
      LIMIT 1
    ) la ON true
    WHERE pr.partner_establishment_id = p_partner_establishment_id
  ) rows;

  RETURN jsonb_build_object('ok', true, 'items', coalesce(v_items, '[]'::jsonb));
EXCEPTION
  WHEN undefined_table THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_table', 'items', '[]'::jsonb);
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM, 'items', '[]'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.get_partner_referrals_dashboard(uuid) IS
  'Lista indicados do parceiro com status do estabelecimento e último agendamento. Fase 3 — somente leitura.';

GRANT EXECUTE ON FUNCTION public.get_partner_referrals_dashboard(uuid) TO authenticated;

COMMIT;
