-- Módulo isolado: WhatsApp Reminders (WaSenderAPI)
-- 003 - RPC para o job buscar agendamentos "1 hora antes" com segurança
-- Observação: Esta função é pensada para ser chamada com SERVICE_ROLE (job/backend).

BEGIN;

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
  -- Defesa em profundidade: só permitir execução com service_role
  WITH ctx AS (
    SELECT date_trunc('minute', timezone(p_timezone, now())) AS now_local
  ),
  appt AS (
    SELECT
      a.*,
      e.name AS establishment_name_joined,
      e.professionals AS establishment_professionals,
      p.whatsapp AS profile_whatsapp,
      p.phone AS profile_phone,
      s.remind_before_minutes,
      s.message_template,
      i.provider,
      i.api_key_encrypted,
      i.phone_number AS instance_phone_number,
      i.status::text AS instance_status,
      date_trunc(
        'minute',
        (a.appointment_date::date + ((substring(a.appointment_time from 1 for 5) || ':00')::time))
      ) AS appt_at_minute
    FROM public.appointments a
    JOIN public.establishments e
      ON e.id = a.establishment_id
    LEFT JOIN public.profiles p
      ON p.id = a.client_id
    JOIN public.whatsapp_reminder_settings s
      ON s.establishment_id = a.establishment_id
     AND s.enabled = true
    JOIN public.whatsapp_instances i
      ON i.establishment_id = a.establishment_id
     AND i.status = 'active'
  )
  SELECT
    a.id AS appointment_id,
    a.establishment_id,
    COALESCE(
      NULLIF(trim(COALESCE(a.client_whatsapp, '')), ''),
      NULLIF(trim(COALESCE(a.profile_whatsapp, '')), ''),
      NULLIF(trim(COALESCE(a.profile_phone, '')), '')
    ) AS client_whatsapp,
    COALESCE(a.client_name, '') AS client_name,
    COALESCE(a.establishment_name_joined, '') AS establishment_name,
    COALESCE(a.service, '') AS service_name,
    COALESCE(
      NULLIF(
        CASE
          -- Se for UUID, tentar traduzir pelo JSON de profissionais do estabelecimento
          WHEN COALESCE(a.professional, '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN (
            SELECT (p->>'name')::text
            FROM jsonb_array_elements(COALESCE(a.establishment_professionals::jsonb, '[]'::jsonb)) p
            WHERE (p->>'id')::text = a.professional
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
  LEFT JOIN public.whatsapp_reminder_logs l
    ON l.appointment_id = a.id
  WHERE auth.role() = 'service_role'
    AND l.id IS NULL
    AND lower(a.status::text) <> 'cancelled'
    AND COALESCE(
      NULLIF(trim(COALESCE(a.client_whatsapp, '')), ''),
      NULLIF(trim(COALESCE(a.profile_whatsapp, '')), ''),
      NULLIF(trim(COALESCE(a.profile_phone, '')), '')
    ) IS NOT NULL
    AND (
      -- Robustez contra atraso do cron: pega lembretes "vencidos" nos últimos 5 minutos.
      (a.appt_at_minute - (a.remind_before_minutes || ' minutes')::interval) >= (ctx.now_local - interval '5 minutes')
      AND
      (a.appt_at_minute - (a.remind_before_minutes || ' minutes')::interval) < (ctx.now_local + interval '1 minute')
    );
$$;

-- Privilégios: apenas service_role
REVOKE ALL ON FUNCTION public.whatsapp_get_due_reminders(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.whatsapp_get_due_reminders(TEXT) TO service_role;

COMMIT;


