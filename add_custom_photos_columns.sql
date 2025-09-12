-- Adicionar colunas para as 4 novas fotos personalizadas (total 7 fotos)
-- Esta migração adiciona as colunas custom_photo_4_url até custom_photo_7_url

ALTER TABLE establishments 
ADD COLUMN custom_photo_4_url TEXT,
ADD COLUMN custom_photo_5_url TEXT,
ADD COLUMN custom_photo_6_url TEXT,
ADD COLUMN custom_photo_7_url TEXT;

-- Comentários explicativos
COMMENT ON COLUMN establishments.custom_photo_4_url IS 'URL da 4ª foto personalizada do estabelecimento';
COMMENT ON COLUMN establishments.custom_photo_5_url IS 'URL da 5ª foto personalizada do estabelecimento';
COMMENT ON COLUMN establishments.custom_photo_6_url IS 'URL da 6ª foto personalizada do estabelecimento';
COMMENT ON COLUMN establishments.custom_photo_7_url IS 'URL da 7ª foto personalizada do estabelecimento';

