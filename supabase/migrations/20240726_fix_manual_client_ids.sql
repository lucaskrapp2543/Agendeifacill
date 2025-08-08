-- Migração para permitir IDs manuais na tabela client_subscriptions
-- Execute este script no SQL Editor do Supabase

-- 1. REMOVER a policy que depende da coluna client_id
DROP POLICY IF EXISTS "Clients can view their own client subscriptions" ON client_subscriptions;

-- 2. Alterar o tipo da coluna client_id para aceitar strings (não apenas UUIDs)
ALTER TABLE client_subscriptions 
ALTER COLUMN client_id TYPE TEXT;

-- 3. RECRIAR a policy com o novo tipo
CREATE POLICY "Clients can view their own client subscriptions"
ON client_subscriptions
FOR SELECT
USING (
  client_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
);

-- 4. Adicionar comentário explicativo
COMMENT ON COLUMN client_subscriptions.client_id IS 'ID do cliente (pode ser UUID ou ID manual)';

-- 5. Verificar se a alteração foi aplicada
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'client_subscriptions' 
AND column_name = 'client_id'; 