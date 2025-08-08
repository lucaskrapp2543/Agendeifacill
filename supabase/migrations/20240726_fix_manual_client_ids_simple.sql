-- Script simples para permitir IDs manuais
-- Execute este script no SQL Editor do Supabase

-- 1. Remover policy
DROP POLICY IF EXISTS "Clients can view their own client subscriptions" ON client_subscriptions;

-- 2. Alterar coluna
ALTER TABLE client_subscriptions ALTER COLUMN client_id TYPE TEXT;

-- 3. Recriar policy
CREATE POLICY "Clients can view their own client subscriptions" ON client_subscriptions FOR SELECT USING (client_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- 4. Verificar
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'client_subscriptions' AND column_name = 'client_id'; 