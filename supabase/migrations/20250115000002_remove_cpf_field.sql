-- Remover campo CPF da tabela profiles
-- Esta migração remove o campo CPF que não está mais sendo usado no cadastro

-- Remover índice do CPF
DROP INDEX IF EXISTS idx_profiles_cpf;

-- Remover coluna CPF
ALTER TABLE public.profiles DROP COLUMN IF EXISTS cpf;

-- Atualizar função de criação de usuário para remover referência ao CPF
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.profiles (id, name, type, is_premium, first_name, last_name, whatsapp, is_new_client)
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
        END,
        NEW.raw_user_meta_data->>'first_name',
        NEW.raw_user_meta_data->>'last_name',
        NEW.raw_user_meta_data->>'whatsapp',
        CASE 
            WHEN NEW.raw_user_meta_data->>'is_new_client' = 'true' THEN true
            ELSE false
        END
    );
    RETURN NEW;
END;
$$;
