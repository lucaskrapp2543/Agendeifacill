-- SQL para corrigir a verificação de vencimento de assinantes
-- Execute este SQL no Supabase para corrigir o problema de agendamento de assinantes vencidos

-- 1. Primeiro, vamos atualizar a função is_whatsapp_subscriber para verificar corretamente o vencimento
CREATE OR REPLACE FUNCTION is_whatsapp_subscriber(
  p_whatsapp TEXT,
  p_establishment_id UUID
)
RETURNS TABLE (
  is_subscriber BOOLEAN,
  subscriber_data JSONB,
  is_expired BOOLEAN,
  expiration_message TEXT
) 
LANGUAGE plpgsql
AS $$
DECLARE
  subscriber_record RECORD;
BEGIN
  -- Buscar o assinante (independente do status de pagamento)
  SELECT 
    cs.id,
    cs.subscriber_name,
    cs.subscriber_whatsapp,
    cs.subscriber_email,
    cs.subscription_id,
    cs.start_date,
    cs.end_date,
    cs.payment_status,
    s.name as subscription_name,
    s.value as subscription_value,
    s.service_duration,
    s.weekdays
  INTO subscriber_record
  FROM client_subscriptions cs
  LEFT JOIN subscriptions s ON cs.subscription_id = s.id
  WHERE cs.subscriber_whatsapp = p_whatsapp
    AND cs.establishment_id = p_establishment_id
    AND cs.start_date <= CURRENT_DATE
  ORDER BY cs.created_at DESC
  LIMIT 1;

  -- Se não encontrou assinante, retornar que não é assinante
  IF subscriber_record.id IS NULL THEN
    RETURN QUERY SELECT false, NULL::JSONB, false, NULL::TEXT;
    RETURN;
  END IF;

  -- Verificar se está vencido
  DECLARE
    is_expired_check BOOLEAN := (subscriber_record.end_date < CURRENT_DATE OR subscriber_record.payment_status = 'unpaid');
    expiration_msg TEXT;
  BEGIN
    IF is_expired_check THEN
      expiration_msg := 'Seu plano venceu em ' || to_char(subscriber_record.end_date, 'DD/MM/YYYY') || '. Renove para continuar agendando.';
    ELSE
      expiration_msg := NULL;
    END IF;

    RETURN QUERY SELECT 
      CASE WHEN is_expired_check THEN false ELSE true END as is_subscriber,
      CASE 
        WHEN is_expired_check THEN 
          jsonb_build_object(
            'id', subscriber_record.id,
            'name', subscriber_record.subscriber_name,
            'whatsapp', subscriber_record.subscriber_whatsapp,
            'email', subscriber_record.subscriber_email,
            'subscription_id', subscriber_record.subscription_id,
            'subscription_name', subscriber_record.subscription_name,
            'subscription_value', subscriber_record.subscription_value,
            'service_duration', subscriber_record.service_duration,
            'weekdays', subscriber_record.weekdays,
            'start_date', subscriber_record.start_date,
            'end_date', subscriber_record.end_date,
            'payment_status', subscriber_record.payment_status,
            'is_expired', true,
            'expiration_message', expiration_msg,
            'subscriptions', jsonb_build_object(
              'id', subscriber_record.subscription_id,
              'name', subscriber_record.subscription_name,
              'value', subscriber_record.subscription_value,
              'service_duration', subscriber_record.service_duration,
              'weekdays', subscriber_record.weekdays
            )
          )
        ELSE 
          jsonb_build_object(
            'id', subscriber_record.id,
            'name', subscriber_record.subscriber_name,
            'whatsapp', subscriber_record.subscriber_whatsapp,
            'email', subscriber_record.subscriber_email,
            'subscription_id', subscriber_record.subscription_id,
            'subscription_name', subscriber_record.subscription_name,
            'subscription_value', subscriber_record.subscription_value,
            'service_duration', subscriber_record.service_duration,
            'weekdays', subscriber_record.weekdays,
            'start_date', subscriber_record.start_date,
            'end_date', subscriber_record.end_date,
            'payment_status', subscriber_record.payment_status,
            'is_expired', false,
            'expiration_message', NULL,
            'subscriptions', jsonb_build_object(
              'id', subscriber_record.subscription_id,
              'name', subscriber_record.subscription_name,
              'value', subscriber_record.subscription_value,
              'service_duration', subscriber_record.service_duration,
              'weekdays', subscriber_record.weekdays
            )
          )
      END as subscriber_data,
      is_expired_check as is_expired,
      expiration_msg as expiration_message;
  END;
END;
$$;

-- 2. Criar função específica para verificar apenas assinantes ativos (para compatibilidade)
CREATE OR REPLACE FUNCTION is_active_whatsapp_subscriber(
  p_whatsapp TEXT,
  p_establishment_id UUID
)
RETURNS TABLE (
  is_subscriber BOOLEAN,
  subscriber_data JSONB
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    result.is_subscriber,
    result.subscriber_data
  FROM is_whatsapp_subscriber(p_whatsapp, p_establishment_id) as result
  WHERE result.is_expired = false;
END;
$$;

-- 3. Atualizar a função get_subscriber_by_whatsapp para incluir verificação de vencimento
CREATE OR REPLACE FUNCTION get_subscriber_by_whatsapp(
  p_whatsapp TEXT,
  p_establishment_id UUID
)
RETURNS TABLE (
  subscriber_id UUID,
  subscriber_name TEXT,
  subscriber_whatsapp TEXT,
  subscriber_email TEXT,
  subscription_name TEXT,
  subscription_value DECIMAL,
  start_date DATE,
  end_date DATE,
  payment_status TEXT,
  is_expired BOOLEAN,
  expiration_message TEXT
) 
LANGUAGE plpgsql
AS $$
DECLARE
  subscriber_record RECORD;
BEGIN
  -- Buscar o assinante
  SELECT 
    cs.id,
    cs.subscriber_name,
    cs.subscriber_whatsapp,
    cs.subscriber_email,
    cs.start_date,
    cs.end_date,
    cs.payment_status,
    s.name as subscription_name,
    s.value as subscription_value
  INTO subscriber_record
  FROM client_subscriptions cs
  LEFT JOIN subscriptions s ON cs.subscription_id = s.id
  WHERE cs.subscriber_whatsapp = p_whatsapp
    AND cs.establishment_id = p_establishment_id
    AND cs.start_date <= CURRENT_DATE
  ORDER BY cs.created_at DESC
  LIMIT 1;

  -- Se não encontrou, retornar vazio
  IF subscriber_record.id IS NULL THEN
    RETURN;
  END IF;

  -- Verificar vencimento e retornar dados
  DECLARE
    is_expired_check BOOLEAN := (subscriber_record.end_date < CURRENT_DATE OR subscriber_record.payment_status = 'unpaid');
    expiration_msg TEXT;
  BEGIN
    IF is_expired_check THEN
      expiration_msg := 'Seu plano venceu em ' || to_char(subscriber_record.end_date, 'DD/MM/YYYY') || '. Renove para continuar agendando.';
    ELSE
      expiration_msg := NULL;
    END IF;

    RETURN QUERY SELECT 
      subscriber_record.id,
      subscriber_record.subscriber_name,
      subscriber_record.subscriber_whatsapp,
      subscriber_record.subscriber_email,
      subscriber_record.subscription_name,
      subscriber_record.subscription_value,
      subscriber_record.start_date,
      subscriber_record.end_date,
      subscriber_record.payment_status,
      is_expired_check,
      expiration_msg;
  END;
END;
$$;

-- 4. Comentários para documentação
COMMENT ON FUNCTION is_whatsapp_subscriber(TEXT, UUID) IS 'Verifica se um WhatsApp é de assinante, incluindo verificação de vencimento';
COMMENT ON FUNCTION is_active_whatsapp_subscriber(TEXT, UUID) IS 'Verifica apenas assinantes ativos (não vencidos)';
COMMENT ON FUNCTION get_subscriber_by_whatsapp(TEXT, UUID) IS 'Busca dados do assinante por WhatsApp, incluindo status de vencimento';

-- 5. Teste da função (opcional - pode remover após testar)
-- SELECT * FROM is_whatsapp_subscriber('48999516123', 'seu-establishment-id-aqui');
