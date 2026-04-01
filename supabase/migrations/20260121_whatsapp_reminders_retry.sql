  -- WhatsApp Reminders: retries confiáveis (não "morrer" no primeiro failed)
  -- - Registra tentativas/next_attempt_at no whatsapp_reminder_logs
  -- - RPC inclui agendamentos vencidos + retries pendentes (até um limite)

  BEGIN;

  -- =========================
  -- 1) Melhorar tabela de logs
  -- =========================
  ALTER TABLE public.whatsapp_reminder_logs
    ADD COLUMN IF NOT EXISTS attempt_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS last_error TEXT NULL;

  -- Se já existiam logs antigos, marcar attempt_count = 1 e last_attempt_at = created_at (quando fizer sentido)
  UPDATE public.whatsapp_reminder_logs
  SET attempt_count = GREATEST(attempt_count, 1),
      last_attempt_at = COALESCE(last_attempt_at, created_at)
  WHERE attempt_count = 0 OR last_attempt_at IS NULL;

  -- =========================
  -- 2) Atualizar RPC para permitir retry
  -- =========================
  CREATE OR REPLACE FUNCTION public.whatsapp_get_due_reminders(p_timezone TEXT DEFAULT 'America/Sao_Paulo')
  RETURNS TABLE (
    appointment_id UUID,
    establishment_id UUID,
    client_whatsapp TEXT,
    client_name TEXT,
    establishment_name TEXT,
    service_name TEXT,
    professional_name TEXT,
    appointment_date DATE,
    appointment_time TEXT,
    remind_before_minutes INT,
    message_template TEXT,
    provider TEXT,
    api_key_encrypted TEXT,
    instance_phone_number TEXT,
    instance_status TEXT
  )
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
  AS $$
    WITH ctx AS (
      SELECT date_trunc('minute', timezone(p_timezone, now())) AS now_local
    ),
    appt AS (
      SELECT
        a.*,
        e.name AS establishment_name_joined,
        e.professionals AS establishment_professionals,
        s.remind_before_minutes,
        s.message_template,
        i.provider,
        i.api_key_encrypted,
        i.phone_number AS instance_phone_number,
        i.status::text AS instance_status,
        date_trunc(
          'minute',
          (a.appointment_date::date + ((substring(a.appointment_time from 1 for 5) || ':00')::time))
        ) AS appt_at_minute,
        date_trunc(
          'minute',
          (a.appointment_date::date + ((substring(a.appointment_time from 1 for 5) || ':00')::time))
          - (s.remind_before_minutes || ' minutes')::interval
        ) AS due_at_minute
      FROM public.appointments a
      JOIN public.establishments e
        ON e.id = a.establishment_id
      JOIN public.whatsapp_reminder_settings s
        ON s.establishment_id = a.establishment_id
      AND s.enabled = true
      JOIN public.whatsapp_instances i
        ON i.establishment_id = a.establishment_id
      AND i.status = 'active'
    ),
    logs AS (
      SELECT l.*
      FROM public.whatsapp_reminder_logs l
    )
    SELECT
      a.id AS appointment_id,
      a.establishment_id,
      NULLIF(trim(COALESCE(a.client_whatsapp, '')), '') AS client_whatsapp,
      COALESCE(a.client_name, '') AS client_name,
      COALESCE(a.establishment_name_joined, '') AS establishment_name,
      COALESCE(a.service, '') AS service_name,
      COALESCE(
        NULLIF(
          CASE
            WHEN COALESCE(a.professional, '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN (
              SELECT (prof_elem->>'name')::text
              FROM unnest(COALESCE(a.establishment_professionals, ARRAY[]::jsonb[])) prof_elem
              WHERE (prof_elem->>'id')::text = a.professional
              LIMIT 1
            )
            ELSE a.professional
          END,
          ''
        ),
        COALESCE(a.professional, '')
      ) AS professional_name,
      a.appointment_date::date AS appointment_date,
      a.appointment_time::text AS appointment_time,
      a.remind_before_minutes,
      a.message_template,
      a.provider,
      a.api_key_encrypted,
      a.instance_phone_number,
      a.instance_status
    FROM appt a
    CROSS JOIN ctx
    LEFT JOIN logs l
      ON l.appointment_id = a.id
    WHERE auth.role() = 'service_role'
      AND lower(a.status::text) <> 'cancelled'
      AND NULLIF(trim(COALESCE(a.client_whatsapp, '')), '') IS NOT NULL
      AND (
        -- Caso 1: lembrete dentro da janela (robustez pro cron)
        (
          a.due_at_minute >= (ctx.now_local - interval '120 minutes')
          AND a.due_at_minute < (ctx.now_local + interval '1 minute')
          AND a.appt_at_minute > ctx.now_local
          AND (l.id IS NULL OR l.status <> 'sent')
        )
        OR
        -- Caso 2: retry pendente (falhou antes, mas queremos tentar de novo)
        (
          l.id IS NOT NULL
          AND l.status = 'failed'
          AND COALESCE(l.attempt_count, 0) < 8
          AND COALESCE(l.next_attempt_at, ctx.now_local) <= ctx.now_local
          -- não ficar tentando pra sempre depois do horário
          AND a.appt_at_minute >= (ctx.now_local - interval '30 minutes')
          AND (l.last_attempt_at IS NULL OR l.last_attempt_at < ctx.now_local)
        )
      );
  $$;

  REVOKE ALL ON FUNCTION public.whatsapp_get_due_reminders(TEXT) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION public.whatsapp_get_due_reminders(TEXT) TO service_role;

  COMMIT;

  NOTIFY pgrst, 'reload schema';

