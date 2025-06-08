-- Adicionar coluna whatsapp
ALTER TABLE establishments
ADD COLUMN IF NOT EXISTS whatsapp TEXT; 