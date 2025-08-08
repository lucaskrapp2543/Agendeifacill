-- Script completo para permitir IDs manuais
-- Execute este script no SQL Editor do Supabase

-- 1. Remover TODAS as policies que dependem da coluna client_id
DROP POLICY IF EXISTS "Clients can view their own client subscriptions" ON client_subscriptions;
DROP POLICY IF EXISTS "Clients can update their own client subscriptions payment statu" ON client_subscriptions;
DROP POLICY IF EXISTS "Establishments can manage their client subscriptions" ON client_subscriptions;

-- 2. Alterar coluna
ALTER TABLE client_subscriptions ALTER COLUMN client_id TYPE TEXT;

-- 3. Recriar policies
CREATE POLICY "Clients can view their own client subscriptions" ON client_subscriptions FOR SELECT USING (client_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Establishments can manage their client subscriptions" ON client_subscriptions FOR ALL USING (establishment_id IN (SELECT id FROM establishments WHERE owner_id = auth.uid()));

-- 4. Verificar
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'client_subscriptions' AND column_name = 'client_id'; 