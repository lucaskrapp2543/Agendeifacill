-- Criar funções RPC para verificação de assinantes
-- Estas funções estão sendo chamadas pelo código mas não existem no banco

-- Função para verificar se um WhatsApp é assinante ativo
CREATE OR REPLACE FUNCTION is_whatsapp_subscriber(
  p_whatsapp TEXT,
  p_establishment_id TEXT
)
RETURNS TABLE(
  is_subscriber BOOLEAN,
  subscriber_data JSONB,
  is_expired BOOLEAN,
  expiration_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  normalized_whatsapp TEXT;
  subscriber_record RECORD;
BEGIN
  -- Normalizar o número de WhatsApp (remover caracteres não numéricos)
  normalized_whatsapp := regexp_replace(p_whatsapp, '[^0-9]', '', 'g');
  
  -- Buscar assinante ativo na tabela premium_subscriptions
  SELECT 
    ps.id,
    ps.display_name,
    ps.whatsapp,
    ps.end_date,
    ps.weekdays,
    ps.subscription_id,
    s.name as subscription_name,
    s.value as subscription_value,
    CASE 
      WHEN ps.end_date >= CURRENT_DATE THEN false
      ELSE true
    END as is_expired
  INTO subscriber_record
  FROM premium_subscriptions ps
  LEFT JOIN subscriptions s ON ps.subscription_id = s.id
  WHERE ps.whatsapp = normalized_whatsapp
    AND ps.establishment_id = p_establishment_id
    AND ps.is_active = true
  ORDER BY ps.created_at DESC
  LIMIT 1;
  
  -- Se encontrou assinante
  IF subscriber_record.id IS NOT NULL THEN
    RETURN QUERY SELECT 
      true as is_subscriber,
      jsonb_build_object(
        'id', subscriber_record.id,
        'name', subscriber_record.display_name,
        'whatsapp', subscriber_record.whatsapp,
        'end_date', subscriber_record.end_date,
        'weekdays', subscriber_record.weekdays,
        'subscription_id', subscriber_record.subscription_id,
        'subscription_name', subscriber_record.subscription_name,
        'subscription_value', subscriber_record.subscription_value,
        'is_expired', subscriber_record.is_expired
      ) as subscriber_data,
      subscriber_record.is_expired as is_expired,
      CASE 
        WHEN subscriber_record.is_expired THEN 'Assinatura vencida em ' || subscriber_record.end_date
        ELSE NULL
      END as expiration_message;
  ELSE
    -- Não encontrou assinante
    RETURN QUERY SELECT 
      false as is_subscriber,
      NULL::jsonb as subscriber_data,
      false as is_expired,
      NULL::text as expiration_message;
  END IF;
END;
$$;

-- Função para buscar assinante por WhatsApp
CREATE OR REPLACE FUNCTION get_subscriber_by_whatsapp(
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
  subscription_value DECIMAL,
  is_expired BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  normalized_whatsapp TEXT;
BEGIN
  -- Normalizar o número de WhatsApp
  normalized_whatsapp := regexp_replace(p_whatsapp, '[^0-9]', '', 'g');
  
  -- Buscar e retornar dados do assinante
  RETURN QUERY
  SELECT 
    ps.id,
    ps.display_name,
    ps.whatsapp,
    ps.end_date,
    ps.weekdays,
    ps.subscription_id,
    s.name as subscription_name,
    s.value as subscription_value,
    CASE 
      WHEN ps.end_date >= CURRENT_DATE THEN false
      ELSE true
    END as is_expired
  FROM premium_subscriptions ps
  LEFT JOIN subscriptions s ON ps.subscription_id = s.id
  WHERE ps.whatsapp = normalized_whatsapp
    AND ps.establishment_id = p_establishment_id
    AND ps.is_active = true
  ORDER BY ps.created_at DESC
  LIMIT 1;
END;
$$;

-- Comentários para documentação
COMMENT ON FUNCTION is_whatsapp_subscriber(TEXT, TEXT) IS 'Verifica se um WhatsApp é assinante ativo de um estabelecimento';
COMMENT ON FUNCTION get_subscriber_by_whatsapp(TEXT, TEXT) IS 'Busca dados de um assinante por WhatsApp e estabelecimento';
