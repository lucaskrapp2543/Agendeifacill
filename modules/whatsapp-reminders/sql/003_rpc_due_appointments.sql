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
  )
  SELECT
    a.id AS appointment_id,
    a.establishment_id,
    COALESCE(
      NULLIF(trim(COALESCE(a.client_whatsapp, '')), ''),
      NULLIF(trim(COALESCE(p.whatsapp, '')), ''),
      NULLIF(trim(COALESCE(p.phone, '')), '')
    ) AS client_whatsapp,
    COALESCE(a.client_name, '') AS client_name,
    COALESCE(e.name, '') AS establishment_name,
    COALESCE(a.service, '') AS service_name,
    COALESCE(a.professional, '') AS professional_name,
    a.appointment_date::date AS appointment_date,
    a.appointment_time::text AS appointment_time,
    s.remind_before_minutes,
    s.message_template,
    i.provider,
    i.api_key_encrypted,
    i.phone_number AS instance_phone_number,
    i.status::text AS instance_status
  FROM public.appointments a
  CROSS JOIN ctx
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
  LEFT JOIN public.whatsapp_reminder_logs l
    ON l.appointment_id = a.id
  WHERE auth.role() = 'service_role'
    AND l.id IS NULL
    AND lower(a.status::text) <> 'cancelled'
    AND COALESCE(
      NULLIF(trim(COALESCE(a.client_whatsapp, '')), ''),
      NULLIF(trim(COALESCE(p.whatsapp, '')), ''),
      NULLIF(trim(COALESCE(p.phone, '')), '')
    ) IS NOT NULL
    AND (
      date_trunc(
        'minute',
        (a.appointment_date::date + ((substring(a.appointment_time from 1 for 5) || ':00')::time))
      ) >= (ctx.now_local + (s.remind_before_minutes || ' minutes')::interval)
      AND
      date_trunc(
        'minute',
        (a.appointment_date::date + ((substring(a.appointment_time from 1 for 5) || ':00')::time))
      ) < (ctx.now_local + ((s.remind_before_minutes + 5) || ' minutes')::interval)
    );
$$;

-- Privilégios: apenas service_role
REVOKE ALL ON FUNCTION public.whatsapp_get_due_reminders(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.whatsapp_get_due_reminders(TEXT) TO service_role;

COMMIT;


