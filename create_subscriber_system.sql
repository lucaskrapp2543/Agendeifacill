-- SQL para criar o sistema independente de assinantes
-- Execute este SQL no Supabase para suportar o novo sistema

-- 1. Adicionar coluna para armazenar dados completos do assinante
ALTER TABLE client_subscriptions 
ADD COLUMN IF NOT EXISTS subscriber_name TEXT,
ADD COLUMN IF NOT EXISTS subscriber_whatsapp TEXT,
ADD COLUMN IF NOT EXISTS subscriber_email TEXT;

-- 2. Criar comentários para documentar as colunas
COMMENT ON COLUMN client_subscriptions.subscriber_name IS 'Nome completo do assinante';
COMMENT ON COLUMN client_subscriptions.subscriber_whatsapp IS 'WhatsApp do assinante (formato: 48999516123)';
COMMENT ON COLUMN client_subscriptions.subscriber_email IS 'Email do assinante (opcional)';

-- 3. Criar índices para melhor performance nas buscas
CREATE INDEX IF NOT EXISTS idx_client_subscriptions_whatsapp 
ON client_subscriptions (subscriber_whatsapp);

CREATE INDEX IF NOT EXISTS idx_client_subscriptions_establishment_whatsapp 
ON client_subscriptions (establishment_id, subscriber_whatsapp);

-- 4. Criar função para verificar se um WhatsApp é de assinante
CREATE OR REPLACE FUNCTION is_whatsapp_subscriber(
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
    CASE WHEN cs.id IS NOT NULL THEN true ELSE false END as is_subscriber,
    CASE 
      WHEN cs.id IS NOT NULL THEN 
        jsonb_build_object(
          'id', cs.id,
          'name', cs.subscriber_name,
          'whatsapp', cs.subscriber_whatsapp,
          'email', cs.subscriber_email,
          'subscription_id', cs.subscription_id,
          'subscription_name', s.name,
          'subscription_value', s.value,
          'service_duration', s.service_duration,
          'weekdays', s.weekdays,
          'start_date', cs.start_date,
          'end_date', cs.end_date,
          'payment_status', cs.payment_status,
          'subscriptions', jsonb_build_object(
            'id', s.id,
            'name', s.name,
            'value', s.value,
            'service_duration', s.service_duration,
            'weekdays', s.weekdays
          )
        )
      ELSE NULL
    END as subscriber_data
  FROM client_subscriptions cs
  LEFT JOIN subscriptions s ON cs.subscription_id = s.id
  WHERE cs.subscriber_whatsapp = p_whatsapp
    AND cs.establishment_id = p_establishment_id
    AND cs.payment_status = 'paid'
    AND cs.end_date >= CURRENT_DATE
    AND cs.start_date <= CURRENT_DATE
  ORDER BY cs.created_at DESC
  LIMIT 1;
END;
$$;

-- 5. Criar função para buscar assinante por WhatsApp
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
  payment_status TEXT
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cs.id,
    cs.subscriber_name,
    cs.subscriber_whatsapp,
    cs.subscriber_email,
    s.name,
    s.value,
    cs.start_date,
    cs.end_date,
    cs.payment_status
  FROM client_subscriptions cs
  LEFT JOIN subscriptions s ON cs.subscription_id = s.id
  WHERE cs.subscriber_whatsapp = p_whatsapp
    AND cs.establishment_id = p_establishment_id
    AND cs.payment_status = 'paid'
    AND cs.end_date >= CURRENT_DATE
    AND cs.start_date <= CURRENT_DATE
  ORDER BY cs.created_at DESC
  LIMIT 1;
END;
$$;

-- 6. Atualizar dados existentes (migração)
-- Copiar dados do client_whatsapp para subscriber_whatsapp se estiver vazio
UPDATE client_subscriptions 
SET subscriber_whatsapp = client_whatsapp
WHERE subscriber_whatsapp IS NULL 
  AND client_whatsapp IS NOT NULL;

-- 7. Verificar se as colunas foram criadas corretamente
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'client_subscriptions' 
  AND column_name IN ('subscriber_name', 'subscriber_whatsapp', 'subscriber_email')
ORDER BY column_name;
