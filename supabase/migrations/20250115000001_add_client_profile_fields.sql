-- Adicionar campos para novos clientes
-- Esta migração adiciona campos para nome, sobrenome, CPF e WhatsApp na tabela profiles
-- Mantém compatibilidade total com contas antigas

-- Adicionar colunas para novos campos de cliente
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS cpf TEXT,
ADD COLUMN IF NOT EXISTS whatsapp TEXT,
ADD COLUMN IF NOT EXISTS is_new_client BOOLEAN DEFAULT false;

-- Criar índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_profiles_whatsapp ON public.profiles(whatsapp);
CREATE INDEX IF NOT EXISTS idx_profiles_cpf ON public.profiles(cpf);
CREATE INDEX IF NOT EXISTS idx_profiles_is_new_client ON public.profiles(is_new_client);

-- Comentários para documentação
COMMENT ON COLUMN public.profiles.first_name IS 'Nome do cliente (para novas contas)';
COMMENT ON COLUMN public.profiles.last_name IS 'Sobrenome do cliente (para novas contas)';
COMMENT ON COLUMN public.profiles.cpf IS 'CPF do cliente (para novas contas)';
COMMENT ON COLUMN public.profiles.whatsapp IS 'WhatsApp do cliente (para novas contas)';
COMMENT ON COLUMN public.profiles.is_new_client IS 'Indica se é uma conta nova com campos obrigatórios';

-- Atualizar função de criação de usuário para suportar novos campos
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.profiles (id, name, type, is_premium, first_name, last_name, cpf, whatsapp, is_new_client)
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
        NEW.raw_user_meta_data->>'cpf',
        NEW.raw_user_meta_data->>'whatsapp',
        CASE 
            WHEN NEW.raw_user_meta_data->>'is_new_client' = 'true' THEN true
            ELSE false
        END
    );
    RETURN NEW;
END;
$$;
