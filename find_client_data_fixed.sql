-- DESCOBRIR onde estão os dados dos clientes (CORRIGIDO)
-- Execute este SQL no Supabase SQL Editor

-- 1. Verificar todas as tabelas que podem ter dados de clientes
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND (table_name ILIKE '%client%' OR table_name ILIKE '%user%' OR table_name ILIKE '%customer%')
ORDER BY table_name;

-- 2. Verificar se há dados na tabela auth.users (tabela padrão do Supabase)
SELECT COUNT(*) as total_auth_users FROM auth.users;

-- 3. Verificar estrutura da tabela client_subscriptions para ver se tem dados de contato
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'client_subscriptions'
ORDER BY ordinal_position;

-- 4. Mostrar alguns registros de client_subscriptions para ver os dados (sem display_name)
SELECT 
    id,
    client_id,
    client_whatsapp,
    created_at
FROM client_subscriptions 
ORDER BY created_at DESC
LIMIT 5;

-- 5. Verificar se há dados na tabela appointments que possam ter WhatsApp
SELECT 
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'appointments'
AND (column_name ILIKE '%whatsapp%' OR column_name ILIKE '%phone%' OR column_name ILIKE '%tel%');

-- 6. Mostrar alguns agendamentos para ver como o WhatsApp é salvo
SELECT 
    id,
    client_name,
    client_whatsapp,
    appointment_date,
    is_subscriber
FROM appointments 
WHERE is_subscriber = true
ORDER BY appointment_date DESC
LIMIT 5;
