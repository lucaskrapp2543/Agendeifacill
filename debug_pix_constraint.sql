-- DEBUG: Verificar constraint da coluna pix_payment_status

-- 1. Verificar a constraint específica
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conname = 'appointments_pix_payment_status_check';

-- 2. Verificar todas as constraints da tabela appointments
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'appointments'::regclass;

-- 3. Verificar valores atuais na tabela
SELECT DISTINCT pix_payment_status, COUNT(*) as quantidade
FROM appointments 
WHERE pix_payment_status IS NOT NULL
GROUP BY pix_payment_status
ORDER BY quantidade DESC;

-- 4. Verificar se a coluna tem um ENUM ou CHECK constraint
SELECT 
    column_name,
    data_type,
    udt_name,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'appointments' 
  AND column_name = 'pix_payment_status';
