-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create simple function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
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

-- Recreate trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add simple insert policy if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' 
        AND policyname = 'Enable insert for service role'
    ) THEN
        CREATE POLICY "Enable insert for service role"
            ON public.profiles
            FOR INSERT
            TO service_role
            WITH CHECK (true);
    END IF;
END
$$; 