-- 6748: diagnosticar os "Profissional" que sobraram (5 atendimentos)
SELECT
  sa.id,
  sa.attendance_date AS data,
  COALESCE(cs.client_name_override, cs.subscriber_name) AS assinante_cadastro,
  sa.repass_value,
  apt.appointment_time AS horario,
  apt.client_name AS cliente_agenda,
  apt.status,
  NULLIF(BTRIM(apt.professional::text), '') AS prof_uuid,
  pl.prof_name AS profissional_sugerido
FROM public.subscriber_attendances sa
INNER JOIN public.establishments e ON e.id = sa.establishment_id AND e.code = '6748'
INNER JOIN public.client_subscriptions cs ON cs.id = sa.client_subscription_id
LEFT JOIN LATERAL (
  SELECT a.appointment_time, a.client_name, a.status, a.professional
  FROM public.appointments a
  WHERE a.establishment_id = sa.establishment_id
    AND a.appointment_date = sa.attendance_date
    AND a.status IN ('completed', 'confirmed', 'pending')
    AND (
      regexp_replace(COALESCE(a.client_whatsapp, ''), '\D', '', 'g') IN (
        regexp_replace(COALESCE(cs.client_whatsapp, ''), '\D', '', 'g'),
        regexp_replace(COALESCE(cs.subscriber_whatsapp, ''), '\D', '', 'g')
      )
      OR lower(trim(COALESCE(a.client_name, ''))) = lower(trim(COALESCE(cs.client_name_override, cs.subscriber_name, '')))
      OR lower(split_part(trim(COALESCE(a.client_name, '')), ' ', 1)) = lower(split_part(trim(COALESCE(cs.client_name_override, cs.subscriber_name, '')), ' ', 1))
      OR lower(COALESCE(a.client_name, '')) LIKE '%' || lower(split_part(trim(COALESCE(cs.client_name_override, cs.subscriber_name, '')), ' ', 1)) || '%'
      OR lower(COALESCE(cs.client_name_override, cs.subscriber_name, '')) LIKE '%' || lower(split_part(trim(COALESCE(a.client_name, '')), ' ', 1)) || '%'
    )
  ORDER BY
    CASE a.status WHEN 'completed' THEN 0 WHEN 'confirmed' THEN 1 ELSE 2 END,
    a.appointment_time
  LIMIT 1
) apt ON true
LEFT JOIN LATERAL (
  SELECT NULLIF(BTRIM(p->>'id'), '') AS prof_id, NULLIF(BTRIM(p->>'name'), '') AS prof_name
  FROM public.establishments est
  CROSS JOIN LATERAL unnest(COALESCE(est.professionals, ARRAY[]::jsonb[])) AS u(p)
  WHERE est.id = sa.establishment_id
) pl ON pl.prof_id = NULLIF(BTRIM(apt.professional::text), '')
WHERE sa.professional_name = 'Profissional'
ORDER BY sa.attendance_date DESC;

-- 6748: corrigir os que sobraram (match flexível de nome/telefone)
WITH prof_lookup AS (
  SELECT e.id AS establishment_id, NULLIF(BTRIM(p->>'id'), '') AS prof_id, NULLIF(BTRIM(p->>'name'), '') AS prof_name
  FROM public.establishments e
  CROSS JOIN LATERAL unnest(COALESCE(e.professionals, ARRAY[]::jsonb[])) AS u(p)
  UNION ALL
  SELECT e.id, NULLIF(BTRIM(p->>'id'), ''), NULLIF(BTRIM(p->>'name'), '')
  FROM public.establishments e
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(e.deleted_professionals, '[]'::jsonb)) AS p
),
sa_matched AS (
  SELECT DISTINCT ON (sa.id)
    sa.id,
    sa.establishment_id,
    NULLIF(BTRIM(apt.professional::text), '') AS appt_prof_raw
  FROM public.subscriber_attendances sa
  INNER JOIN public.establishments e ON e.id = sa.establishment_id AND e.code = '6748'
  INNER JOIN public.client_subscriptions cs ON cs.id = sa.client_subscription_id
  INNER JOIN LATERAL (
    SELECT a.professional
    FROM public.appointments a
    WHERE a.establishment_id = sa.establishment_id
      AND a.appointment_date = sa.attendance_date
      AND a.status IN ('completed', 'confirmed', 'pending')
      AND (
        regexp_replace(COALESCE(a.client_whatsapp, ''), '\D', '', 'g') IN (
          regexp_replace(COALESCE(cs.client_whatsapp, ''), '\D', '', 'g'),
          regexp_replace(COALESCE(cs.subscriber_whatsapp, ''), '\D', '', 'g')
        )
        OR lower(trim(COALESCE(a.client_name, ''))) = lower(trim(COALESCE(cs.client_name_override, cs.subscriber_name, '')))
        OR lower(split_part(trim(COALESCE(a.client_name, '')), ' ', 1)) = lower(split_part(trim(COALESCE(cs.client_name_override, cs.subscriber_name, '')), ' ', 1))
        OR lower(COALESCE(a.client_name, '')) LIKE '%' || lower(split_part(trim(COALESCE(cs.client_name_override, cs.subscriber_name, '')), ' ', 1)) || '%'
        OR lower(COALESCE(cs.client_name_override, cs.subscriber_name, '')) LIKE '%' || lower(split_part(trim(COALESCE(a.client_name, '')), ' ', 1)) || '%'
      )
    ORDER BY
      CASE a.status WHEN 'completed' THEN 0 WHEN 'confirmed' THEN 1 ELSE 2 END,
      a.appointment_time
    LIMIT 1
  ) apt ON true
  WHERE sa.professional_name = 'Profissional'
  ORDER BY sa.id
),
sa_resolved AS (
  SELECT
    m.id,
    COALESCE(
      pl.prof_name,
      CASE WHEN m.appt_prof_raw ~* '^[0-9a-f]{8}-' THEN NULL ELSE m.appt_prof_raw END
    ) AS resolved_name,
    CASE
      WHEN m.appt_prof_raw ~* '^[0-9a-f]{8}-' THEN m.appt_prof_raw
      ELSE (
        SELECT pl2.prof_id FROM prof_lookup pl2
        WHERE pl2.establishment_id = m.establishment_id
          AND lower(trim(pl2.prof_name)) = lower(trim(m.appt_prof_raw))
        LIMIT 1
      )
    END AS resolved_professional_id
  FROM sa_matched m
  LEFT JOIN prof_lookup pl ON pl.establishment_id = m.establishment_id AND pl.prof_id = m.appt_prof_raw
  WHERE COALESCE(pl.prof_name, CASE WHEN m.appt_prof_raw ~* '^[0-9a-f]{8}-' THEN NULL ELSE m.appt_prof_raw END) IS NOT NULL
)
UPDATE public.subscriber_attendances sa
SET professional_name = sr.resolved_name, professional_id = sr.resolved_professional_id
FROM sa_resolved sr
WHERE sa.id = sr.id;
