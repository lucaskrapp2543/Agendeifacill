-- Adicionar coluna card_brand na tabela appointments
-- Este SQL adiciona a coluna para armazenar a bandeira do cartão

-- 1. Adicionar a coluna card_brand
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS card_brand VARCHAR(50);

-- 2. Adicionar comentário para documentar a coluna
COMMENT ON COLUMN appointments.card_brand IS 'Bandeira do cartão (visa, mastercard, elo, etc.)';

-- 3. Verificar se a coluna foi criada
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'appointments' 
AND column_name = 'card_brand';

-- 4. Mostrar estrutura atual da tabela
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'appointments' 
ORDER BY ordinal_position;
