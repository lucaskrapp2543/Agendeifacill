-- PASSO A (opcional): DIAGNÓSTICO — rode sozinho para ver de quem era cada "Profissional".
-- Troque '6748' pelo código do estabelecimento ou remova o filtro de code.

/*
WITH prof_lookup AS (
  SELECT
    e.id AS establishment_id,
    NULLIF(BTRIM(p->>'id'), '') AS prof_id,
    NULLIF(BTRIM(p->>'name'), '') AS prof_name
  FROM public.establishments e
  CROSS JOIN LATERAL unnest(COALESCE(e.professionals, ARRAY[]::jsonb[])) AS u(p)
  UNION ALL
  SELECT
    e.id AS establishment_id,
    NULLIF(BTRIM(p->>'id'), '') AS prof_id,
    NULLIF(BTRIM(p->>'name'), '') AS prof_name
  FROM public.establishments e
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(e.deleted_professionals, '[]'::jsonb)) AS p
)
SELECT
  sa.id AS atendimento_id,
  sa.attendance_date AS data,
  COALESCE(cs.client_name_override, cs.subscriber_name, sa.client_name_snapshot, 'Assinante') AS cliente,
  sa.professional_name AS nome_gravado,
  a.appointment_time AS horario_agenda,
  a.client_name AS cliente_agenda,
  COALESCE(
    pl.prof_name,
    CASE
      WHEN NULLIF(BTRIM(a.professional::text), '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-'
        THEN NULL
      ELSE NULLIF(BTRIM(a.professional::text), '')
    END
  ) AS profissional_detectado
FROM public.subscriber_attendances sa
INNER JOIN public.establishments e ON e.id = sa.establishment_id
INNER JOIN public.client_subscriptions cs ON cs.id = sa.client_subscription_id
LEFT JOIN public.appointments a ON a.id = sa.appointment_id
LEFT JOIN LATERAL (
  SELECT DISTINCT ON (sa2.id)
    sa2.id,
    apt.id AS apt_id,
    apt.appointment_time,
    apt.client_name,
    apt.professional
  FROM public.subscriber_attendances sa2
  INNER JOIN public.client_subscriptions cs2 ON cs2.id = sa2.client_subscription_id
  INNER JOIN public.appointments apt ON apt.establishment_id = sa2.establishment_id
    AND apt.appointment_date = sa2.attendance_date
    AND apt.status = 'completed'
    AND (
      regexp_replace(COALESCE(apt.client_whatsapp, ''), '\D', '', 'g') IN (
        regexp_replace(COALESCE(cs2.client_whatsapp, ''), '\D', '', 'g'),
        regexp_replace(COALESCE(cs2.subscriber_whatsapp, ''), '\D', '', 'g')
      )
      OR lower(trim(COALESCE(apt.client_name, ''))) = lower(trim(COALESCE(cs2.client_name_override, cs2.subscriber_name, '')))
    )
  WHERE sa2.id = sa.id
  ORDER BY sa2.id, apt.appointment_time
) linked ON true
LEFT JOIN prof_lookup pl ON pl.establishment_id = sa.establishment_id
  AND pl.prof_id = NULLIF(BTRIM(COALESCE(a.professional, linked.professional)::text), '')
WHERE sa.professional_name = 'Profissional'
  AND e.code = '6748'
ORDER BY sa.attendance_date DESC, a.appointment_time;
*/

-- PASSO B: CORREÇÃO — resolve "Profissional" pelo agendamento concluído do mesmo dia/assinante.
WITH prof_lookup AS (
  SELECT
    e.id AS establishment_id,
    NULLIF(BTRIM(p->>'id'), '') AS prof_id,
    NULLIF(BTRIM(p->>'name'), '') AS prof_name
  FROM public.establishments e
  CROSS JOIN LATERAL unnest(COALESCE(e.professionals, ARRAY[]::jsonb[])) AS u(p)

  UNION ALL

  SELECT
    e.id AS establishment_id,
    NULLIF(BTRIM(p->>'id'), '') AS prof_id,
    NULLIF(BTRIM(p->>'name'), '') AS prof_name
  FROM public.establishments e
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(e.deleted_professionals, '[]'::jsonb)) AS p
),
sa_with_appt AS (
  SELECT DISTINCT ON (sa.id)
    sa.id,
    sa.establishment_id,
    NULLIF(BTRIM(sa.professional_id::text), '') AS old_professional_id,
    COALESCE(
      NULLIF(BTRIM(a_direct.professional::text), ''),
      NULLIF(BTRIM(a_linked.professional::text), '')
    ) AS appt_professional_raw
  FROM public.subscriber_attendances sa
  INNER JOIN public.client_subscriptions cs ON cs.id = sa.client_subscription_id
  LEFT JOIN public.appointments a_direct ON a_direct.id = sa.appointment_id
  LEFT JOIN LATERAL (
    SELECT apt.professional
    FROM public.appointments apt
    WHERE apt.establishment_id = sa.establishment_id
      AND apt.appointment_date = sa.attendance_date
      AND apt.status = 'completed'
      AND (
        regexp_replace(COALESCE(apt.client_whatsapp, ''), '\D', '', 'g') IN (
          regexp_replace(COALESCE(cs.client_whatsapp, ''), '\D', '', 'g'),
          regexp_replace(COALESCE(cs.subscriber_whatsapp, ''), '\D', '', 'g')
        )
        OR lower(trim(COALESCE(apt.client_name, ''))) = lower(trim(COALESCE(cs.client_name_override, cs.subscriber_name, '')))
      )
    ORDER BY apt.appointment_time
    LIMIT 1
  ) a_linked ON true
  WHERE sa.professional_name = 'Profissional'
     OR sa.professional_name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ORDER BY sa.id, a_direct.appointment_time NULLS LAST
),
sa_resolved AS (
  SELECT
    c.id,
    COALESCE(
      pl.prof_name,
      CASE
        WHEN c.appt_professional_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-' THEN NULL
        ELSE c.appt_professional_raw
      END
    ) AS resolved_name,
    COALESCE(
      c.old_professional_id,
      CASE
        WHEN c.appt_professional_raw ~* '^[0-9a-f]{8}-' THEN c.appt_professional_raw
        ELSE NULL
      END,
      (
        SELECT pl2.prof_id
        FROM prof_lookup pl2
        WHERE pl2.establishment_id = c.establishment_id
          AND lower(trim(pl2.prof_name)) = lower(trim(c.appt_professional_raw))
        LIMIT 1
      )
    ) AS resolved_professional_id
  FROM sa_with_appt c
  LEFT JOIN prof_lookup pl
    ON pl.establishment_id = c.establishment_id
   AND pl.prof_id = c.appt_professional_raw
  WHERE COALESCE(
    pl.prof_name,
    CASE
      WHEN c.appt_professional_raw ~* '^[0-9a-f]{8}-' THEN NULL
      ELSE c.appt_professional_raw
    END
  ) IS NOT NULL
)
UPDATE public.subscriber_attendances sa
SET
  professional_name = sr.resolved_name,
  professional_id = sr.resolved_professional_id
FROM sa_resolved sr
WHERE sa.id = sr.id
  AND sr.resolved_name IS NOT NULL
  AND sr.resolved_name <> COALESCE(sa.professional_name, '');
