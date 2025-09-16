-- BUSCAR o WhatsApp 48991919191 em TODAS as tabelas de assinantes
-- Versão simplificada para evitar erros de campos

-- 1. Verificar na tabela premium_subscriptions
SELECT 'premium_subscriptions' as tabela, id, whatsapp, created_at
FROM premium_subscriptions 
WHERE whatsapp = '48991919191';

-- 2. Verificar na tabela client_subscriptions (buscar por client_id)
SELECT 'client_subscriptions' as tabela, id, client_id, establishment_id, created_at
FROM client_subscriptions 
WHERE client_id::text = '483d9669-ac01-41d1-bc79-3b288eb23543';

-- 3. Verificar na tabela profiles (campo whatsapp)
SELECT 'profiles' as tabela, id, name, whatsapp, is_subscriber, created_at
FROM profiles 
WHERE whatsapp = '48991919191';

-- 4. Verificar na tabela auth.users (metadata)
SELECT 'auth.users' as tabela, id, email, raw_user_meta_data->>'whatsapp' as whatsapp, created_at
FROM auth.users 
WHERE raw_user_meta_data->>'whatsapp' = '48991919191';

-- 5. Verificar se existe na tabela subscribers (sem campo whatsapp)
SELECT 'subscribers' as tabela, id, created_at
FROM subscribers 
WHERE id = '483d9669-ac01-41d1-bc79-3b288eb23543';
