-- REMOVER POLICY DUPLICADA E RECRIAR
-- Execute este script no SQL Editor do Supabase

-- 1. Remover a policy duplicada
DROP POLICY IF EXISTS "Establishments can manage their client subscriptions" ON client_subscriptions;

-- 2. Recriar a policy corretamente
CREATE POLICY "Establishments can manage their client subscriptions" ON client_subscriptions FOR ALL USING (establishment_id IN (SELECT id FROM establishments WHERE owner_id = auth.uid()));

-- 3. Verificar se a tabela aceita TEXT
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'client_subscriptions' AND column_name = 'client_id';

-- 4. Testar inserção
INSERT INTO client_subscriptions (client_id, subscription_id, establishment_id, start_date, end_date) 
VALUES ('test_manual_id', (SELECT id FROM subscriptions LIMIT 1), (SELECT id FROM establishments LIMIT 1), '2025-08-08', '2025-09-08')
ON CONFLICT DO NOTHING; 