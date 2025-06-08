-- Primeiro, vamos garantir que o RLS está desativado temporariamente
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Remover todas as políticas existentes
DROP POLICY IF EXISTS "Users can read their own profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profiles" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for service role" ON public.profiles;
DROP POLICY IF EXISTS "Allow trigger to create profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow public read access" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow function to create profile" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for users" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Enable update for users based on id" ON public.profiles;

-- Revogar todas as permissões existentes
REVOKE ALL ON public.profiles FROM anon, authenticated, service_role;
REVOKE ALL ON SCHEMA public FROM anon, authenticated, service_role;

-- Conceder permissões básicas no schema
GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;

-- Conceder permissões na tabela profiles
GRANT ALL ON public.profiles TO authenticated, service_role;
GRANT SELECT, INSERT ON public.profiles TO anon;

-- Conceder permissões nas sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon, service_role;

-- Reativar RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Criar políticas simples e permissivas
CREATE POLICY "Enable all access for service role"
    ON public.profiles
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Enable read for all"
    ON public.profiles
    FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE POLICY "Enable insert for all"
    ON public.profiles
    FOR INSERT
    TO authenticated, anon
    WITH CHECK (true);

CREATE POLICY "Enable update for own rows"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Atualizar a função handle_new_user para ser mais permissiva
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
            WHEN NEW.raw_user_meta_data->>'role' = 'establishment' THEN 'establishment'
            ELSE 'client'
        END,
        CASE 
            WHEN NEW.raw_user_meta_data->>'role' = 'premium' THEN true
            ELSE false
        END
    );
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error (você pode ver isso nos logs do Supabase)
        RAISE LOG 'Error in handle_new_user: %', SQLERRM;
        RETURN NEW;
END;
$$; 