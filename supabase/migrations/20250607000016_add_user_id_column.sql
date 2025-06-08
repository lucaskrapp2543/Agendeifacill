-- Adicionar coluna user_id
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Copiar os IDs existentes para a nova coluna
UPDATE public.profiles
SET user_id = id
WHERE user_id IS NULL;

-- Atualizar a função handle_new_user para usar ambas as colunas
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.profiles (id, user_id, name, type, is_premium)
    VALUES (
        NEW.id,
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
        RAISE LOG 'Error in handle_new_user: %', SQLERRM;
        RETURN NEW;
END;
$$; 