-- MIGRAÇÃO: Adicionar coluna affiliate_link para estabelecimentos
-- Execute este SQL no Console do Supabase (https://app.supabase.com > SQL Editor)

-- Verificar se a coluna não existe antes de adicionar
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='establishments' AND column_name='affiliate_link') THEN
        ALTER TABLE establishments ADD COLUMN affiliate_link TEXT;
        RAISE NOTICE 'Coluna affiliate_link adicionada com sucesso!';
    ELSE
        RAISE NOTICE 'Coluna affiliate_link já existe.';
    END IF;
END $$;

-- Adicionar comentário descritivo
COMMENT ON COLUMN establishments.affiliate_link IS 'Link afiliado do estabelecimento (site, Instagram, loja online, etc.)';

-- Verificar se foi criada corretamente
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'establishments' AND column_name = 'affiliate_link'; 