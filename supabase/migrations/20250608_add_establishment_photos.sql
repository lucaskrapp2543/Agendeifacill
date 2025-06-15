-- Adicionar campos para fotos personalizadas dos estabelecimentos
ALTER TABLE establishments 
ADD COLUMN IF NOT EXISTS custom_photo_1_url TEXT,
ADD COLUMN IF NOT EXISTS custom_photo_2_url TEXT,
ADD COLUMN IF NOT EXISTS custom_photo_3_url TEXT;

-- Verificar se as colunas foram criadas
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'establishments' 
AND column_name IN ('custom_photo_1_url', 'custom_photo_2_url', 'custom_photo_3_url'); 