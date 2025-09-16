-- BUSCAR o WhatsApp 48991919191 em TODAS as tabelas de assinantes
-- Vamos encontrar onde está esse registro maldito!

-- 1. Verificar na tabela premium_subscriptions
SELECT 'premium_subscriptions' as tabela, id, display_name, whatsapp, created_at
FROM premium_subscriptions 
WHERE whatsapp = '48991919191';

-- 2. Verificar na tabela client_subscriptions
SELECT 'client_subscriptions' as tabela, id, client_id, establishment_id, start_date, end_date, created_at
FROM client_subscriptions 
WHERE client_id::text IN (
  SELECT id::text FROM auth.users 
  WHERE raw_user_meta_data->>'whatsapp' = '48991919191'
  OR id::text IN (
    SELECT id::text FROM profiles 
    WHERE whatsapp = '48991919191'
  )
);

-- 3. Verificar na tabela subscribers
SELECT 'subscribers' as tabela, id, whatsapp, created_at
FROM subscribers 
WHERE whatsapp = '48991919191';

-- 4. Verificar na tabela profiles (campo whatsapp)
SELECT 'profiles' as tabela, id, name, whatsapp, is_subscriber, created_at
FROM profiles 
WHERE whatsapp = '48991919191';

-- 5. Verificar na tabela auth.users (metadata)
SELECT 'auth.users' as tabela, id, email, raw_user_meta_data->>'whatsapp' as whatsapp, created_at
FROM auth.users 
WHERE raw_user_meta_data->>'whatsapp' = '48991919191';
