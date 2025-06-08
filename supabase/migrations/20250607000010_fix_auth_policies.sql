-- Garantir que o RLS está ativado
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Adicionar política para permitir inserção pelo trigger
CREATE POLICY "Allow trigger to create profiles"
    ON public.profiles
    FOR INSERT
    WITH CHECK (true);

-- Garantir permissões básicas
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT INSERT ON public.profiles TO anon, authenticated;

-- Garantir que o service role tem todas as permissões
GRANT ALL ON public.profiles TO service_role; 