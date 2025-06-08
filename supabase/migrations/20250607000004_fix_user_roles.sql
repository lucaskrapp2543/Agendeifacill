-- Drop existing type if exists
DROP TYPE IF EXISTS user_role CASCADE;

-- Recreate user_role type
CREATE TYPE user_role AS ENUM ('client', 'premium', 'establishment');

-- Drop existing triggers and functions
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Drop existing table
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Create profiles table with correct structure
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    is_premium BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Remove any existing RLS policies
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.profiles TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.profiles (id, name, type, is_premium)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
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
$$;

-- Create trigger for new user creation
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create policies
CREATE POLICY "Enable read access for all users"
    ON public.profiles
    FOR SELECT
    TO public
    USING (true);

CREATE POLICY "Enable insert for authenticated users only"
    ON public.profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Enable update for users based on id"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Reset sequences if needed
ALTER SEQUENCE IF EXISTS profiles_id_seq RESTART WITH 1; 