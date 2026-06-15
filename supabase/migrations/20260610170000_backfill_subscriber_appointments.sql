-- Repara agendamentos de assinante inconsistentes e insere atendimentos faltantes.
-- NÃO cria agendamento novo. NÃO muda data/hora/profissional.
-- Seguro para rodar mais de uma vez (idempotente).

-- PASSO 1) Marcar is_subscriber=true onde há assinatura paga válida na data.
ALTER TABLE public.appointments DISABLE TRIGGER check_appointment_conflict_trigger;

WITH matched AS (
  SELECT DISTINCT ON (a.id)
    a.id AS appointment_id,
    COALESCE(cs.subscription_id, cs.id) AS subscription_ref
  FROM public.appointments a
  INNER JOIN public.client_subscriptions cs ON cs.establishment_id = a.establishment_id
  WHERE COALESCE(a.is_subscriber, false) = false
    AND a.status IN ('completed', 'confirmed', 'pending')
    AND LOWER(COALESCE(cs.payment_status::text, '')) = 'paid'
    AND (cs.start_date IS NULL OR cs.start_date <= a.appointment_date)
    AND (cs.end_date IS NULL OR cs.end_date >= a.appointment_date)
    AND (
      regexp_replace(COALESCE(a.client_whatsapp, ''), '\D', '', 'g') =
        regexp_replace(COALESCE(cs.client_whatsapp, ''), '\D', '', 'g')
      OR regexp_replace(COALESCE(a.client_whatsapp, ''), '\D', '', 'g') =
        regexp_replace(COALESCE(cs.subscriber_whatsapp, ''), '\D', '', 'g')
      OR (
        COALESCE(a.price, 0) <= 0
        AND COALESCE(a.total_price, COALESCE(a.price, 0), 0) <= 0
        AND COALESCE(a.is_loyalty_reward, false) = false
        AND (
          LOWER(COALESCE(a.payment_method, '')) = 'assinante'
          OR NULLIF(BTRIM(COALESCE(a.subscription_id::text, '')), '') IS NOT NULL
          OR NULLIF(BTRIM(COALESCE(a.subscriber_service_id::text, '')), '') IS NOT NULL
          OR NULLIF(BTRIM(COALESCE(a.subscriber_service_name, '')), '') IS NOT NULL
        )
      )
    )
  ORDER BY a.id, cs.updated_at DESC NULLS LAST, cs.created_at DESC NULLS LAST
)
UPDATE public.appointments a
SET
  is_subscriber = true,
  payment_method = CASE
    WHEN LOWER(COALESCE(a.payment_method, '')) = 'assinante' THEN a.payment_method
    ELSE 'assinante'
  END,
  subscription_id = COALESCE(a.subscription_id, matched.subscription_ref)
FROM matched
WHERE a.id = matched.appointment_id;

ALTER TABLE public.appointments ENABLE TRIGGER check_appointment_conflict_trigger;

-- PASSO 2) Inserir atendimentos faltantes (Meus Assinantes).
-- Usa só colunas base da tabela subscriber_attendances (compatível com banco legado).
INSERT INTO public.subscriber_attendances (
  establishment_id,
  client_subscription_id,
  professional_name,
  attendance_date,
  repass_value
)
SELECT DISTINCT ON (a.id)
  a.establishment_id,
  cs.id AS client_subscription_id,
  COALESCE(
    (
      SELECT NULLIF(BTRIM(p->>'name'), '')
      FROM public.establishments e
      CROSS JOIN LATERAL unnest(COALESCE(e.professionals, ARRAY[]::jsonb[])) AS u(p)
      WHERE e.id = a.establishment_id
        AND NULLIF(BTRIM(p->>'id'), '') = NULLIF(BTRIM(a.professional::text), '')
      LIMIT 1
    ),
    (
      SELECT NULLIF(BTRIM(p->>'name'), '')
      FROM public.establishments e
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(e.deleted_professionals, '[]'::jsonb)) AS p
      WHERE e.id = a.establishment_id
        AND NULLIF(BTRIM(p->>'id'), '') = NULLIF(BTRIM(a.professional::text), '')
      LIMIT 1
    ),
    CASE
      WHEN NULLIF(BTRIM(a.professional::text), '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-'
        THEN NULL
      ELSE NULLIF(BTRIM(a.professional::text), '')
    END,
    'Profissional'
  ) AS professional_name,
  a.appointment_date AS attendance_date,
  0::numeric AS repass_value
FROM public.appointments a
INNER JOIN public.client_subscriptions cs ON cs.establishment_id = a.establishment_id
WHERE a.status = 'completed'
  AND (
    COALESCE(a.is_subscriber, false) = true
    OR LOWER(COALESCE(a.payment_method, '')) = 'assinante'
    OR NULLIF(BTRIM(COALESCE(a.subscription_id::text, '')), '') IS NOT NULL
  )
  AND LOWER(COALESCE(cs.payment_status::text, '')) = 'paid'
  AND (cs.start_date IS NULL OR cs.start_date <= a.appointment_date)
  AND (cs.end_date IS NULL OR cs.end_date >= a.appointment_date)
  AND (
    regexp_replace(COALESCE(a.client_whatsapp, ''), '\D', '', 'g') =
      regexp_replace(COALESCE(cs.client_whatsapp, ''), '\D', '', 'g')
    OR regexp_replace(COALESCE(a.client_whatsapp, ''), '\D', '', 'g') =
      regexp_replace(COALESCE(cs.subscriber_whatsapp, ''), '\D', '', 'g')
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.subscriber_attendances sa
    WHERE sa.establishment_id = a.establishment_id
      AND sa.client_subscription_id = cs.id
      AND sa.attendance_date = a.appointment_date
  )
ORDER BY a.id, cs.updated_at DESC NULLS LAST, cs.created_at DESC NULLS LAST;
