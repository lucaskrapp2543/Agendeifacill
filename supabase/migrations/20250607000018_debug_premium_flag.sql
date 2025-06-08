-- Atualizar a função handle_new_user para adicionar logs
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    is_premium_user boolean;
BEGIN
    -- Determinar se é usuário premium
    is_premium_user := NEW.raw_user_meta_data->>'role' = 'premium';
    
    -- Log para debug
    RAISE LOG 'Creating new user profile:';
    RAISE LOG 'User ID: %', NEW.id;
    RAISE LOG 'Role from metadata: %', NEW.raw_user_meta_data->>'role';
    RAISE LOG 'Is Premium: %', is_premium_user;
    
    INSERT INTO public.profiles (id, user_id, name, type, is_premium)
    VALUES (
        NEW.id,
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        CASE 
            WHEN NEW.raw_user_meta_data->>'role' = 'establishment' THEN 'establishment'
            ELSE 'client'
        END,
        is_premium_user
    );
    
    -- Log após a inserção
    RAISE LOG 'Profile created successfully';
    
    RETURN NEW;
EXCEPTION
    WHEN others THEN
    RAISE LOG 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Verificar usuários premium existentes
DO $$
DECLARE
    user_record RECORD;
BEGIN
    FOR user_record IN 
        SELECT 
            u.id,
            u.raw_user_meta_data->>'role' as role,
            p.is_premium
        FROM auth.users u
        LEFT JOIN public.profiles p ON p.id = u.id
    LOOP
        RAISE LOG 'User ID: %, Role: %, Is Premium: %', 
            user_record.id, 
            user_record.role, 
            user_record.is_premium;
    END LOOP;
END;
$$; 