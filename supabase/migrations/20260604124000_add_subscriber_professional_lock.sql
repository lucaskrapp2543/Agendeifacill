BEGIN;

-- Permite fixar um profissional específico por assinante (ou "todos" quando null).
ALTER TABLE public.client_subscriptions
  ADD COLUMN IF NOT EXISTS subscriber_professional_id uuid NULL;

ALTER TABLE public.client_subscriptions
  ADD COLUMN IF NOT EXISTS subscriber_professional_name text NULL;

COMMENT ON COLUMN public.client_subscriptions.subscriber_professional_id
  IS 'Profissional fixo para o assinante no booking. Null = todos os profissionais.';

COMMENT ON COLUMN public.client_subscriptions.subscriber_professional_name
  IS 'Nome do profissional fixo no momento do cadastro/edição (cache para exibição).';

DROP FUNCTION IF EXISTS public.check_subscriber_by_whatsapp(TEXT, TEXT);

CREATE FUNCTION public.check_subscriber_by_whatsapp(
  p_whatsapp TEXT,
  p_establishment_id TEXT
)
RETURNS TABLE(
  id UUID,
  display_name TEXT,
  whatsapp TEXT,
  end_date DATE,
  weekdays TEXT[],
  subscription_id UUID,
  subscription_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  establishment_id TEXT,
  payment_status TEXT,
  is_active BOOLEAN,
  is_expired BOOLEAN,
  expiration_message TEXT,
  service_duration INTEGER,
  subscriber_professional_id UUID,
  subscriber_professional_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  subscriber_record RECORD;
BEGIN
  p_whatsapp := regexp_replace(p_whatsapp, '[^0-9]', '', 'g');

  SELECT
    cs.id,
    COALESCE(cs.client_name_override, cs.subscriber_name) as display_name,
    COALESCE(cs.client_whatsapp, cs.subscriber_whatsapp) as whatsapp,
    cs.end_date,
    COALESCE(cs.weekdays, s.weekdays) as weekdays,
    cs.subscription_id,
    s.name as subscription_name,
    cs.created_at,
    cs.establishment_id::TEXT,
    cs.payment_status::TEXT as payment_status,
    CASE WHEN cs.end_date >= CURRENT_DATE THEN true ELSE false END as is_active,
    CASE
      WHEN cs.end_date < CURRENT_DATE THEN true
      ELSE false
    END as is_expired,
    CASE
      WHEN cs.end_date < CURRENT_DATE THEN 'Seu plano venceu em ' || cs.end_date::text || '. Renove para continuar agendando.'
      ELSE NULL
    END as expiration_message,
    COALESCE(s.service_duration, 30)::INTEGER as service_duration,
    cs.subscriber_professional_id,
    cs.subscriber_professional_name
  INTO subscriber_record
  FROM public.client_subscriptions cs
  LEFT JOIN public.subscriptions s ON cs.subscription_id = s.id
  WHERE (cs.client_whatsapp = p_whatsapp OR cs.subscriber_whatsapp = p_whatsapp)
    AND cs.establishment_id::TEXT = p_establishment_id
    AND NOT cs.client_id LIKE 'manual_%'
  ORDER BY cs.created_at DESC
  LIMIT 1;

  IF subscriber_record.id IS NOT NULL THEN
    RETURN QUERY SELECT
      subscriber_record.id,
      subscriber_record.display_name,
      subscriber_record.whatsapp,
      subscriber_record.end_date,
      subscriber_record.weekdays,
      subscriber_record.subscription_id,
      subscriber_record.subscription_name,
      subscriber_record.created_at,
      subscriber_record.establishment_id,
      subscriber_record.payment_status,
      subscriber_record.is_active,
      subscriber_record.is_expired,
      subscriber_record.expiration_message,
      subscriber_record.service_duration,
      subscriber_record.subscriber_professional_id,
      subscriber_record.subscriber_professional_name;
  END IF;

  RETURN;
END;
$$;

COMMENT ON FUNCTION public.check_subscriber_by_whatsapp(TEXT, TEXT)
  IS 'Verifica assinante pelo WhatsApp e retorna também o profissional fixo (quando definido) para restringir o booking.';

GRANT EXECUTE ON FUNCTION public.check_subscriber_by_whatsapp(TEXT, TEXT) TO anon, authenticated, service_role;

COMMIT;

