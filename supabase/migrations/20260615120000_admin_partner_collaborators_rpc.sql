-- Fase 4: visão admin dos parceiros/colaboradores (Indique e Ganhe).

BEGIN;

CREATE OR REPLACE FUNCTION public.get_admin_partner_collaborators()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partners jsonb;
BEGIN
  IF NOT public.is_admin_user() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden', 'partners', '[]'::jsonb);
  END IF;

  WITH referral_items AS (
    SELECT
      pr.partner_establishment_id,
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
      ) AS item
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
  ),
  referral_groups AS (
    SELECT
      partner_establishment_id,
      coalesce(jsonb_agg(item ORDER BY (item->>'linked_at') DESC NULLS LAST), '[]'::jsonb) AS referrals
    FROM referral_items
    GROUP BY partner_establishment_id
  ),
  partner_ids AS (
    SELECT establishment_id AS partner_establishment_id FROM public.partner_referral_codes
    UNION
    SELECT partner_establishment_id FROM public.partner_referrals
  )
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'partner_establishment_id', pid.partner_establishment_id,
        'partner_name', coalesce(nullif(btrim(pe.name), ''), 'Parceiro'),
        'partner_code', coalesce(pe.code::text, ''),
        'coupon_code', prc.code,
        'coupon_created_at', prc.created_at,
        'coupon_is_active', coalesce(prc.is_active, false),
        'referrals', coalesce(rg.referrals, '[]'::jsonb)
      )
      ORDER BY coalesce(prc.created_at, pe.created_at) DESC NULLS LAST
    ),
    '[]'::jsonb
  )
  INTO v_partners
  FROM partner_ids pid
  INNER JOIN public.establishments pe ON pe.id = pid.partner_establishment_id
  LEFT JOIN public.partner_referral_codes prc ON prc.establishment_id = pid.partner_establishment_id
  LEFT JOIN referral_groups rg ON rg.partner_establishment_id = pid.partner_establishment_id
  WHERE prc.id IS NOT NULL
     OR jsonb_array_length(coalesce(rg.referrals, '[]'::jsonb)) > 0;

  RETURN jsonb_build_object('ok', true, 'partners', coalesce(v_partners, '[]'::jsonb));
EXCEPTION
  WHEN undefined_table THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_table', 'partners', '[]'::jsonb);
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM, 'partners', '[]'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.get_admin_partner_collaborators() IS
  'Lista parceiros com cupom e/ou indicações para o admin (Fase 4 — somente leitura).';

GRANT EXECUTE ON FUNCTION public.get_admin_partner_collaborators() TO authenticated;

COMMIT;
