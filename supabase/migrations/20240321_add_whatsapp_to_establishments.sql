-- Adicionar coluna whatsapp se não existir
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'establishments' 
        AND column_name = 'whatsapp'
    ) THEN 
        ALTER TABLE establishments ADD COLUMN whatsapp TEXT;
    END IF;
END $$; 