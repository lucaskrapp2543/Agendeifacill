-- Script para adicionar rastreamento de último acesso dos clientes
-- Execute este script no Supabase SQL Editor

-- 1. Adicionar coluna last_access_at na tabela client_subscriptions
ALTER TABLE client_subscriptions 
ADD COLUMN IF NOT EXISTS last_access_at TIMESTAMP WITH TIME ZONE;

-- 2. Adicionar comentário para documentar a coluna
COMMENT ON COLUMN client_subscriptions.last_access_at IS 'Data e hora do último acesso do cliente ao sistema de agendamentos';

-- 3. Criar função para atualizar o último acesso
CREATE OR REPLACE FUNCTION update_client_last_access(client_whatsapp_param TEXT)
RETURNS VOID AS $$
BEGIN
  -- Atualizar last_access_at para o cliente específico
  UPDATE client_subscriptions 
  SET last_access_at = NOW()
  WHERE client_whatsapp = client_whatsapp_param
    AND is_active = true;
    
  -- Log da atualização
  RAISE NOTICE 'Último acesso atualizado para cliente: %', client_whatsapp_param;
END;
$$ LANGUAGE plpgsql;

-- 4. Criar função para buscar último acesso de um cliente
CREATE OR REPLACE FUNCTION get_client_last_access(client_whatsapp_param TEXT)
RETURNS TIMESTAMP WITH TIME ZONE AS $$
DECLARE
  last_access TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT last_access_at INTO last_access
  FROM client_subscriptions 
  WHERE client_whatsapp = client_whatsapp_param
    AND is_active = true
  ORDER BY created_at DESC
  LIMIT 1;
  
  RETURN last_access;
END;
$$ LANGUAGE plpgsql;

-- 5. Verificar se as colunas foram criadas corretamente
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'client_subscriptions' 
  AND column_name = 'last_access_at';

-- 6. Testar as funções (opcional - descomente para testar)
-- SELECT update_client_last_access('47999999999');
-- SELECT get_client_last_access('47999999999');
