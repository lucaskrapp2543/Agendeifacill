-- Add is_premium column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false;

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

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

-- Update existing premium users if any
UPDATE public.profiles
SET is_premium = true
WHERE id IN (
  SELECT id 
  FROM auth.users 
  WHERE raw_user_meta_data->>'role' = 'premium'
); 