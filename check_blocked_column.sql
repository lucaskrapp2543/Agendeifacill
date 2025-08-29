-- Verificar se a coluna is_blocked existe
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'establishments' 
AND column_name = 'is_blocked';

-- Se não existir, criar a coluna
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'establishments' 
        AND column_name = 'is_blocked'
    ) THEN
        ALTER TABLE establishments ADD COLUMN is_blocked BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Coluna is_blocked criada com sucesso';
    ELSE
        RAISE NOTICE 'Coluna is_blocked ja existe';
    END IF;
END $$;

-- Verificar novamente após a criação
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'establishments' 
AND column_name = 'is_blocked';
