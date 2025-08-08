-- DESABILITAR TRIGGER TEMPORARIAMENTE (MAIS SEGURO)
-- Execute este script no SQL Editor do Supabase

-- 1. Desabilitar o trigger temporariamente (não remove)
ALTER TABLE client_subscriptions DISABLE TRIGGER update_is_subscriber_trigger;
ALTER TABLE client_subscriptions DISABLE TRIGGER update_is_subscriber_on_update_trigger;

-- 2. Verificar se foram desabilitados
SELECT trigger_name, action_timing, event_manipulation 
FROM information_schema.triggers 
WHERE event_object_table = 'client_subscriptions';

-- 3. Testar inserção manual
INSERT INTO client_subscriptions (client_id, subscription_id, establishment_id, start_date, end_date) 
VALUES ('test_manual_id', (SELECT id FROM subscriptions LIMIT 1), (SELECT id FROM establishments LIMIT 1), '2025-08-08', '2025-09-08')
ON CONFLICT DO NOTHING; 