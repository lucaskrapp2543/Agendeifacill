-- Adicionar coluna is_premium
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false; 