/*
  # Initial Schema Setup

  1. New Tables
    - profiles (user profiles with role information)
    - establishments (business profiles)
    - appointments (booking records)
  
  2. Security
    - Enable RLS on all tables
    - Add policies for data access control
    
  3. Automation
    - Trigger for automatic profile creation
*/

-- Create role enum type
CREATE TYPE user_role AS ENUM ('client', 'premium', 'establishment');

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  is_premium BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT profiles_type_check CHECK (type IN ('client', 'establishment'))
);

-- Create establishments table
CREATE TABLE IF NOT EXISTS establishments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES auth.users(id) NOT NULL,
  services TEXT[] DEFAULT ARRAY[]::TEXT[],
  business_hours JSONB DEFAULT '{}'::JSONB
);

-- Create appointments table
CREATE TYPE appointment_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');

CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  client_id UUID REFERENCES auth.users(id) NOT NULL,
  establishment_id UUID REFERENCES establishments(id) NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TEXT NOT NULL,
  service TEXT NOT NULL,
  status appointment_status DEFAULT 'pending'
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE establishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can read their own profiles"
  ON profiles
  FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update their own profiles"
  ON profiles
  FOR UPDATE
  USING (id = auth.uid());

-- Establishments policies
CREATE POLICY "Owners can manage their establishments"
  ON establishments
  FOR ALL
  USING (owner_id = auth.uid());

CREATE POLICY "All users can view establishments"
  ON establishments
  FOR SELECT
  TO authenticated
  USING (true);

-- Appointments policies
CREATE POLICY "Clients can view their own appointments"
  ON appointments
  FOR SELECT
  TO authenticated
  USING (client_id = auth.uid());

CREATE POLICY "Clients can create appointments"
  ON appointments
  FOR INSERT
  TO authenticated
  WITH CHECK (client_id = auth.uid());

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

-- Create function to handle profile updates
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating the updated_at timestamp
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- Create trigger to automatically insert user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, type, is_premium)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    CASE 
      WHEN NEW.raw_user_meta_data->>'role' = 'premium' THEN 'client'
      WHEN NEW.raw_user_meta_data->>'role' = 'establishment' THEN 'establishment'
      ELSE 'client'
    END,
    CASE 
      WHEN NEW.raw_user_meta_data->>'role' = 'premium' THEN true
      ELSE false
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();