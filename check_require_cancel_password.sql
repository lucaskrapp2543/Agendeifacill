-- Verificar se a coluna require_cancel_password existe
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'establishments'
AND column_name = 'require_cancel_password';

-- Se não retornar nada, a coluna não existe. Execute:
-- ALTER TABLE establishments ADD COLUMN IF NOT EXISTS require_cancel_password BOOLEAN DEFAULT false;

-- Verificar valores atuais
SELECT id, name, require_cancel_password 
FROM establishments 
WHERE require_cancel_password IS NOT NULL
LIMIT 10;

