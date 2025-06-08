/*
  # Update Establishments Table

  1. Rename column
    - Rename user_id to owner_id in establishments table
  
  2. Update policies
    - Update RLS policies to use owner_id instead of user_id
*/

-- Rename column
ALTER TABLE establishments RENAME COLUMN user_id TO owner_id;

-- Drop existing policies
DROP POLICY IF EXISTS "Owners can manage their establishments" ON establishments;
DROP POLICY IF EXISTS "All users can view establishments" ON establishments;

-- Recreate policies with owner_id
CREATE POLICY "Owners can manage their establishments"
  ON establishments
  FOR ALL
  USING (auth.uid() = owner_id);

CREATE POLICY "All users can view establishments"
  ON establishments
  FOR SELECT
  TO authenticated
  USING (true);

-- Update appointment policies that reference establishments.user_id
DROP POLICY IF EXISTS "Establishment owners can view their appointments" ON appointments;
DROP POLICY IF EXISTS "Establishment owners can update appointment status" ON appointments;

CREATE POLICY "Establishment owners can view their appointments"
  ON appointments
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT e.owner_id FROM establishments e WHERE e.id = establishment_id
    )
  );

CREATE POLICY "Establishment owners can update appointment status"
  ON appointments
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT e.owner_id FROM establishments e WHERE e.id = establishment_id
    )
  );

-- Adicionar colunas que faltam na tabela establishments
ALTER TABLE establishments 
ADD COLUMN IF NOT EXISTS professionals JSONB[] DEFAULT ARRAY[]::JSONB[],
ADD COLUMN IF NOT EXISTS services_with_prices JSONB[] DEFAULT ARRAY[]::JSONB[],
ADD COLUMN IF NOT EXISTS profile_image_url TEXT,
ALTER COLUMN business_hours SET DEFAULT '{
  "monday": {"open": "09:00", "close": "18:00", "enabled": true},
  "tuesday": {"open": "09:00", "close": "18:00", "enabled": true},
  "wednesday": {"open": "09:00", "close": "18:00", "enabled": true},
  "thursday": {"open": "09:00", "close": "18:00", "enabled": true},
  "friday": {"open": "09:00", "close": "18:00", "enabled": true},
  "saturday": {"open": "09:00", "close": "18:00", "enabled": false},
  "sunday": {"open": "09:00", "close": "18:00", "enabled": false}
}'::JSONB;

-- Adicionar colunas que faltam na tabela appointments
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS professional TEXT NOT NULL DEFAULT 'Não especificado',
ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS price DECIMAL(10,2);

-- Remover o default depois de adicionar a coluna
ALTER TABLE appointments 
ALTER COLUMN professional DROP DEFAULT;

-- Corrigir a chave estrangeira da tabela appointments
ALTER TABLE appointments
DROP CONSTRAINT IF EXISTS appointments_user_id_fkey,
ADD CONSTRAINT appointments_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES profiles(user_id) 
  ON DELETE CASCADE; 