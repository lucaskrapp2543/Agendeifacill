-- Adicionar campos de assinante na tabela client_subscriptions
-- Execute este script no SQL Editor do Supabase

-- Adicionar campos para dados completos do assinante
ALTER TABLE client_subscriptions 
ADD COLUMN IF NOT EXISTS subscriber_name TEXT,
ADD COLUMN IF NOT EXISTS subscriber_whatsapp TEXT,
ADD COLUMN IF NOT EXISTS subscriber_email TEXT;

-- Criar índice para busca por WhatsApp
CREATE INDEX IF NOT EXISTS idx_client_subscriptions_subscriber_whatsapp 
ON client_subscriptions(subscriber_whatsapp);

-- Verificar se os campos foram adicionados
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'client_subscriptions' 
  AND column_name IN ('subscriber_name', 'subscriber_whatsapp', 'subscriber_email');
