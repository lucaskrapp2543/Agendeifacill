-- Adicionar campo de aniversário na tabela profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS birthday DATE;

-- Criar índice para melhorar performance nas consultas de aniversário
CREATE INDEX IF NOT EXISTS idx_profiles_birthday ON profiles (birthday);

-- Adicionar comentário explicativo
COMMENT ON COLUMN profiles.birthday IS 'Data de aniversário do cliente'; 