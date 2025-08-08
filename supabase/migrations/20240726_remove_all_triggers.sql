-- REMOVER TODOS OS TRIGGERS DE UMA VEZ
-- Execute este script no SQL Editor do Supabase

-- 1. Remover TODOS os triggers que dependem da função
DROP TRIGGER IF EXISTS update_is_subscriber_trigger ON client_subscriptions;
DROP TRIGGER IF EXISTS update_is_subscriber_on_update_trigger ON client_subscriptions;

-- 2. Remover a função com CASCADE
DROP FUNCTION IF EXISTS update_is_subscriber() CASCADE;

-- 3. Recriar a função com lógica correta
CREATE OR REPLACE FUNCTION update_is_subscriber()
RETURNS TRIGGER AS $$
BEGIN
    -- Para UUIDs: converter para UUID e comparar
    IF NEW.client_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        UPDATE profiles
        SET is_subscriber = (SELECT EXISTS (SELECT 1 FROM client_subscriptions WHERE client_id::uuid = NEW.client_id::uuid))
        WHERE user_id = NEW.client_id::uuid;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Recriar APENAS o trigger principal
CREATE TRIGGER update_is_subscriber_trigger
    AFTER INSERT OR DELETE ON client_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_is_subscriber();

-- 5. Verificar se foi criado
SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'client_subscriptions'; 