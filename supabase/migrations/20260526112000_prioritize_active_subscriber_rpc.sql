-- Corrige a seleção de assinante no booking público quando existe mais de um
-- registro para o mesmo WhatsApp. Antes a RPC pegava o registro mais recente
-- por created_at, podendo retornar uma assinatura vencida mesmo existindo outra
-- paga e válida para o mesmo cliente.

BEGIN;

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
  service_duration INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_whatsapp TEXT;
  v_whatsapp_without_country TEXT;
  subscriber_record RECORD;
BEGIN
  v_whatsapp := regexp_replace(COALESCE(p_whatsapp, ''), '[^0-9]', '', 'g');
  v_whatsapp_without_country := CASE
    WHEN v_whatsapp LIKE '55%' AND length(v_whatsapp) > 11 THEN substring(v_whatsapp from 3)
    ELSE v_whatsapp
  END;

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
    CASE
      WHEN cs.end_date >= CURRENT_DATE AND lower(COALESCE(cs.payment_status::TEXT, '')) = 'paid' THEN true
      ELSE false
    END as is_active,
    CASE
      WHEN cs.end_date < CURRENT_DATE OR lower(COALESCE(cs.payment_status::TEXT, '')) = 'unpaid' THEN true
      ELSE false
    END as is_expired,
    CASE
      WHEN lower(COALESCE(cs.payment_status::TEXT, '')) = 'unpaid' THEN 'Sua assinatura está com pagamento pendente. Renove para continuar agendando.'
      WHEN cs.end_date < CURRENT_DATE THEN 'Seu plano venceu em ' || cs.end_date::text || '. Renove para continuar agendando.'
      ELSE NULL
    END as expiration_message,
    COALESCE(s.service_duration, 30)::INTEGER as service_duration
  INTO subscriber_record
  FROM public.client_subscriptions cs
  LEFT JOIN public.subscriptions s ON cs.subscription_id = s.id
  WHERE cs.establishment_id::TEXT = p_establishment_id
    AND COALESCE(cs.client_id::TEXT, '') NOT LIKE 'manual_%'
    AND (
      regexp_replace(COALESCE(cs.client_whatsapp, ''), '[^0-9]', '', 'g') IN (v_whatsapp, v_whatsapp_without_country, '55' || v_whatsapp_without_country)
      OR regexp_replace(COALESCE(cs.subscriber_whatsapp, ''), '[^0-9]', '', 'g') IN (v_whatsapp, v_whatsapp_without_country, '55' || v_whatsapp_without_country)
    )
  ORDER BY
    CASE
      WHEN cs.end_date >= CURRENT_DATE AND lower(COALESCE(cs.payment_status::TEXT, '')) = 'paid' THEN 0
      WHEN cs.end_date >= CURRENT_DATE THEN 1
      WHEN lower(COALESCE(cs.payment_status::TEXT, '')) = 'paid' THEN 2
      ELSE 3
    END,
    cs.end_date DESC NULLS LAST,
    COALESCE(cs.updated_at, cs.created_at) DESC NULLS LAST,
    cs.created_at DESC NULLS LAST
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
      subscriber_record.service_duration;
  END IF;

  RETURN;
END;
$$;

COMMENT ON FUNCTION public.check_subscriber_by_whatsapp(TEXT, TEXT)
  IS 'Verifica assinante por WhatsApp priorizando registro pago e vigente quando há duplicidade.';

GRANT EXECUTE ON FUNCTION public.check_subscriber_by_whatsapp(TEXT, TEXT) TO anon, authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
