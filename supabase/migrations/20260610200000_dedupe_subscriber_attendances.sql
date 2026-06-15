-- Remove atendimentos de assinatura duplicados (backfill/polling repetido).
-- Mantém 1 registro por agendamento (appointment_id) ou por dia+profissional (legado).
-- Idempotente: pode rodar mais de uma vez.

-- 1) Duplicados com appointment_id
WITH ranked_by_appointment AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY establishment_id, appointment_id
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM public.subscriber_attendances
  WHERE appointment_id IS NOT NULL
)
DELETE FROM public.subscriber_attendances sa
USING ranked_by_appointment r
WHERE sa.id = r.id
  AND r.rn > 1;

-- 2) Duplicados legados (sem appointment_id): mesmo assinante + dia + profissional
WITH ranked_legacy AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY
        establishment_id,
        client_subscription_id,
        attendance_date,
        COALESCE(NULLIF(BTRIM(professional_id::text), ''), NULLIF(BTRIM(professional_name), ''), 'profissional')
      ORDER BY
        CASE WHEN appointment_id IS NOT NULL THEN 0 ELSE 1 END,
        created_at ASC NULLS LAST,
        id ASC
    ) AS rn
  FROM public.subscriber_attendances
)
DELETE FROM public.subscriber_attendances sa
USING ranked_legacy r
WHERE sa.id = r.id
  AND r.rn > 1;

-- 3) Fantasmas de backfill: sem vínculo com agendamento (não entram no financeiro)
DELETE FROM public.subscriber_attendances
WHERE appointment_id IS NULL
  AND COALESCE(BTRIM(professional_name), '') <> 'Adicionado em Meus Assinantes';

-- 4) Índice único parcial: impede duplicar o mesmo agendamento no futuro
CREATE UNIQUE INDEX IF NOT EXISTS uq_subscriber_attendances_appointment_id
  ON public.subscriber_attendances (establishment_id, appointment_id)
  WHERE appointment_id IS NOT NULL;
