-- Drop existing foreign key if exists
ALTER TABLE appointments
DROP CONSTRAINT IF EXISTS appointments_user_id_fkey,
DROP CONSTRAINT IF EXISTS appointments_client_id_fkey;

-- Add correct foreign key for client_id
ALTER TABLE appointments
ADD CONSTRAINT appointments_client_id_fkey
  FOREIGN KEY (client_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Create RLS policies for appointments
DROP POLICY IF EXISTS "Clients can view their own appointments" ON appointments;
DROP POLICY IF EXISTS "Clients can create appointments" ON appointments;
DROP POLICY IF EXISTS "Establishment owners can view their appointments" ON appointments;
DROP POLICY IF EXISTS "Establishment owners can update appointment status" ON appointments;

-- Recreate policies
CREATE POLICY "Clients can view their own appointments"
  ON appointments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = client_id);

CREATE POLICY "Clients can create appointments"
  ON appointments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = client_id);

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