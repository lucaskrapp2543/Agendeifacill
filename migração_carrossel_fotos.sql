-- Migração para adicionar colunas de fotos personalizadas
-- Execute este SQL no seu banco de dados Supabase

ALTER TABLE establishments 
ADD COLUMN IF NOT EXISTS custom_photo_1_url TEXT,
ADD COLUMN IF NOT EXISTS custom_photo_2_url TEXT,
ADD COLUMN IF NOT EXISTS custom_photo_3_url TEXT;

-- Comentários para documentação
COMMENT ON COLUMN establishments.custom_photo_1_url IS 'URL da primeira foto personalizada do estabelecimento';
COMMENT ON COLUMN establishments.custom_photo_2_url IS 'URL da segunda foto personalizada do estabelecimento';
COMMENT ON COLUMN establishments.custom_photo_3_url IS 'URL da terceira foto personalizada do estabelecimento';

-- Verificar se as colunas foram criadas
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'establishments' 
AND column_name LIKE 'custom_photo_%'
ORDER BY column_name; 