-- Adicionar coluna phone na tabela profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS phone TEXT;

-- Comentário explicativo
COMMENT ON COLUMN profiles.phone IS 'Número de telefone do usuário';

-- Verificar se a coluna foi criada
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
AND column_name IN ('name', 'phone')
ORDER BY column_name;
