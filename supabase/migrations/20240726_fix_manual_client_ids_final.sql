-- Script FINAL para permitir IDs manuais
-- Execute este script no SQL Editor do Supabase

-- 1. Remover foreign key constraint
ALTER TABLE client_subscriptions DROP CONSTRAINT IF EXISTS client_subscriptions_client_id_fkey;

-- 2. Remover TODAS as policies que dependem da coluna client_id
DROP POLICY IF EXISTS "Clients can view their own client subscriptions" ON client_subscriptions;
DROP POLICY IF EXISTS "Clients can update their own client subscriptions payment statu" ON client_subscriptions;
DROP POLICY IF EXISTS "Establishments can manage their client subscriptions" ON client_subscriptions;

-- 3. Alterar coluna
ALTER TABLE client_subscriptions ALTER COLUMN client_id TYPE TEXT;

-- 4. Recriar policies (com cast para UUID)
CREATE POLICY "Clients can view their own client subscriptions" ON client_subscriptions FOR SELECT USING (client_id::uuid IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Establishments can manage their client subscriptions" ON client_subscriptions FOR ALL USING (establishment_id IN (SELECT id FROM establishments WHERE owner_id = auth.uid()));

-- 5. Verificar
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'client_subscriptions' AND column_name = 'client_id'; 