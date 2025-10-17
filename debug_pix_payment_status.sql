-- DEBUG: Verificar coluna pix_payment_status na tabela appointments

-- 1. Verificar se a coluna existe
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'appointments' 
  AND column_name = 'pix_payment_status';

-- 2. Verificar estrutura da tabela appointments
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'appointments'
ORDER BY ordinal_position;

-- 3. Verificar se há constraints na coluna
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_name = 'appointments' 
  AND kcu.column_name = 'pix_payment_status';

-- 4. Verificar alguns agendamentos com PIX
SELECT 
    id,
    client_name,
    payment_method,
    pix_payment_status,
    created_at
FROM appointments 
WHERE payment_method = 'pix'
ORDER BY created_at DESC
LIMIT 5;

-- 5. Verificar se há RLS (Row Level Security) ativo
SELECT schemaname, tablename, rowsecurity
FROM pg_tables 
WHERE tablename = 'appointments';
