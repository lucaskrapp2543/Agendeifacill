-- Adicionar campo client_whatsapp na tabela client_subscriptions
-- Execute este script no SQL Editor do Supabase

-- Adicionar campo client_whatsapp
ALTER TABLE client_subscriptions 
ADD COLUMN IF NOT EXISTS client_whatsapp TEXT;

-- Criar índice para busca por WhatsApp
CREATE INDEX IF NOT EXISTS idx_client_subscriptions_client_whatsapp 
ON client_subscriptions(client_whatsapp);

-- Verificar se o campo foi adicionado
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'client_subscriptions' 
  AND column_name = 'client_whatsapp';
