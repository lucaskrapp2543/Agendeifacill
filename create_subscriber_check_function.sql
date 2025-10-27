-- Função RPC corrigida - apenas sistema antigo (client_subscriptions)
-- Esta função funciona mesmo quando o usuário não está logado
-- AGORA INCLUI O NOME DO PLANO

CREATE OR REPLACE FUNCTION check_subscriber_by_whatsapp(
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
  is_active BOOLEAN,
  is_expired BOOLEAN,
  expiration_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  subscriber_record RECORD;
BEGIN
  -- Normalizar o número de WhatsApp (remover caracteres não numéricos)
  p_whatsapp := regexp_replace(p_whatsapp, '[^0-9]', '', 'g');
  
  -- Buscar assinante com JOIN na tabela subscriptions para pegar o nome do plano
  SELECT 
    cs.id,
    COALESCE(cs.client_name_override, cs.subscriber_name) as display_name,
    COALESCE(cs.client_whatsapp, cs.subscriber_whatsapp) as whatsapp,
    cs.end_date,
    COALESCE(cs.weekdays, s.weekdays) as weekdays, -- Usar weekdays do plano se o cliente não tiver
    cs.subscription_id,
    s.name as subscription_name,
    cs.created_at,
    cs.establishment_id::TEXT,
    CASE WHEN cs.end_date >= CURRENT_DATE THEN true ELSE false END as is_active,
    CASE 
      WHEN cs.end_date < CURRENT_DATE THEN true
      ELSE false
    END as is_expired,
    CASE 
      WHEN cs.end_date < CURRENT_DATE THEN 'Seu plano venceu em ' || cs.end_date::text || '. Renove para continuar agendando.'
      ELSE NULL
    END as expiration_message
  INTO subscriber_record
  FROM client_subscriptions cs
  LEFT JOIN subscriptions s ON cs.subscription_id = s.id
  WHERE (cs.client_whatsapp = p_whatsapp OR cs.subscriber_whatsapp = p_whatsapp)
    AND cs.establishment_id::TEXT = p_establishment_id
    AND NOT cs.client_id LIKE 'manual_%'
  ORDER BY cs.created_at DESC
  LIMIT 1;
  
  -- Se encontrou assinante, retornar os dados
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
      subscriber_record.is_active,
      subscriber_record.is_expired,
      subscriber_record.expiration_message;
  END IF;
  
  -- Se não encontrou, retornar vazio
  RETURN;
END;
$$;

-- Comentário explicativo
COMMENT ON FUNCTION check_subscriber_by_whatsapp(TEXT, TEXT) IS 'Verifica se um WhatsApp é assinante ativo ou vencido, funcionando sem autenticação';