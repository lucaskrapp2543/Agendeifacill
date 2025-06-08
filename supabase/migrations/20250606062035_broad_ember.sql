/*
  # Initial Database Setup

  1. New Tables
    - `profiles`
      - `id` (uuid, primary key)
      - `created_at` (timestamp)
      - `user_id` (uuid, references auth.users)
      - `full_name` (text)
      - `role` (enum: 'client', 'premium', 'establishment')
    
    - `establishments`
      - `id` (uuid, primary key)
      - `created_at` (timestamp)
      - `name` (text)
      - `code` (text, unique)
      - `description` (text)
      - `user_id` (uuid, references auth.users)
      - `services` (text array)
      - `business_hours` (jsonb)
    
    - `appointments`
      - `id` (uuid, primary key)
      - `created_at` (timestamp)
      - `client_id` (uuid, references auth.users)
      - `establishment_id` (uuid, references establishments)
      - `appointment_date` (date)
      - `appointment_time` (text)
      - `service` (text)
      - `professional` (text)
      - `status` (enum: 'pending', 'confirmed', 'cancelled', 'completed')
  
  2. Security
    - Enable RLS on all tables
    - Add policies for:
      - Profiles: users can read/write their own profiles
      - Establishments: owners can manage their establishments, all users can read
      - Appointments: clients can create and view their appointments, establishments can view related appointments
*/

-- Create profiles table
CREATE TYPE user_role AS ENUM ('client', 'premium', 'establishment');

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID REFERENCES auth.users(id) NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role user_role NOT NULL
);

-- Create establishments table
CREATE TABLE IF NOT EXISTS establishments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  services TEXT[] DEFAULT ARRAY[]::TEXT[],
  business_hours JSONB DEFAULT '{
    "monday": {"open": "09:00", "close": "18:00", "enabled": true},
    "tuesday": {"open": "09:00", "close": "18:00", "enabled": true},
    "wednesday": {"open": "09:00", "close": "18:00", "enabled": true},
    "thursday": {"open": "09:00", "close": "18:00", "enabled": true},
    "friday": {"open": "09:00", "close": "18:00", "enabled": true},
    "saturday": {"open": "09:00", "close": "13:00", "enabled": true},
    "sunday": {"open": "09:00", "close": "13:00", "enabled": false}
  }'::JSONB,
  professionals JSONB[] DEFAULT ARRAY[]::JSONB[],
  services_with_prices JSONB[] DEFAULT ARRAY[]::JSONB[],
  profile_image_url TEXT
);

-- Create storage bucket for profile images
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-images', 'profile-images', true);

-- Enable RLS on storage bucket
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access to profile images
CREATE POLICY "Public Access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'profile-images');

-- Create policy to allow authenticated users to upload profile images
CREATE POLICY "Authenticated users can upload profile images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'profile-images'
    AND auth.role() = 'authenticated'
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
  professional TEXT NOT NULL,
  status appointment_status NOT NULL DEFAULT 'pending'
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE establishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can read their own profiles"
  ON profiles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own profiles"
  ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profiles"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Establishments policies
CREATE POLICY "Owners can manage their establishments"
  ON establishments
  FOR ALL
  USING (auth.uid() = user_id);

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
      SELECT e.user_id FROM establishments e WHERE e.id = establishment_id
    )
  );

CREATE POLICY "Establishment owners can update appointment status"
  ON appointments
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT e.user_id FROM establishments e WHERE e.id = establishment_id
    )
  );

-- Create triggers to automatically insert user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, role)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'), 
    (NEW.raw_user_meta_data->>'role')::user_role
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();