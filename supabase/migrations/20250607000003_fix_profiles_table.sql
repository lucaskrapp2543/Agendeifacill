-- Drop existing triggers and functions
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Drop existing table
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Recreate profiles table with correct structure
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  is_premium BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT profiles_type_check CHECK (type IN ('client', 'establishment'))
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Add policies
CREATE POLICY "Users can read their own profiles"
  ON profiles
  FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update their own profiles"
  ON profiles
  FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "System can insert user profiles"
  ON public.profiles
  FOR INSERT
  WITH CHECK (true);

-- Grant permissions
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- Create updated function to handle new users
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

-- Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user(); 