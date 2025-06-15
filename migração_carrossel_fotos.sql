-- Migração para adicionar colunas de fotos personalizadas na tabela establishments
-- Execute este SQL no painel do Supabase > SQL Editor

ALTER TABLE establishments 
ADD COLUMN IF NOT EXISTS custom_photo_1_url TEXT,
ADD COLUMN IF NOT EXISTS custom_photo_2_url TEXT,
ADD COLUMN IF NOT EXISTS custom_photo_3_url TEXT;

-- Verificar se as colunas foram criadas
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'establishments' 
AND column_name LIKE 'custom_photo%'
ORDER BY column_name; 