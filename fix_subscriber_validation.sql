-- Script completo para corrigir a validação de assinantes
-- Execute este script no SQL Editor do Supabase

-- 1. Adicionar campo limit_subscriber_bookings na tabela establishments
ALTER TABLE establishments 
ADD COLUMN IF NOT EXISTS limit_subscriber_bookings BOOLEAN DEFAULT false;

-- 2. Adicionar campo client_whatsapp na tabela client_subscriptions
ALTER TABLE client_subscriptions 
ADD COLUMN IF NOT EXISTS client_whatsapp TEXT;

-- 3. Adicionar campos adicionais para dados completos do assinante
ALTER TABLE client_subscriptions 
ADD COLUMN IF NOT EXISTS subscriber_name TEXT,
ADD COLUMN IF NOT EXISTS subscriber_whatsapp TEXT,
ADD COLUMN IF NOT EXISTS subscriber_email TEXT;

-- 4. Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_establishments_limit_subscriber_bookings 
ON establishments(limit_subscriber_bookings);

CREATE INDEX IF NOT EXISTS idx_client_subscriptions_client_whatsapp 
ON client_subscriptions(client_whatsapp);

CREATE INDEX IF NOT EXISTS idx_client_subscriptions_subscriber_whatsapp 
ON client_subscriptions(subscriber_whatsapp);

-- 5. Verificar se todos os campos foram adicionados
SELECT 
  'establishments' as table_name,
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'establishments' 
  AND column_name = 'limit_subscriber_bookings'

UNION ALL

SELECT 
  'client_subscriptions' as table_name,
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'client_subscriptions' 
  AND column_name IN ('client_whatsapp', 'subscriber_name', 'subscriber_whatsapp', 'subscriber_email')

ORDER BY table_name, column_name;
