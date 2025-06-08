-- Criar tabela para assinaturas premium
CREATE TABLE IF NOT EXISTS public.premium_subscriptions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    establishment_id UUID REFERENCES public.establishments(id),
    display_name TEXT NOT NULL,
    whatsapp TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    is_winner BOOLEAN DEFAULT false,
    winner_position SMALLINT,
    last_draw_date TIMESTAMPTZ,
    UNIQUE(user_id, establishment_id)
);

-- Habilitar RLS
ALTER TABLE public.premium_subscriptions ENABLE ROW LEVEL SECURITY;

-- Criar políticas de acesso
CREATE POLICY "Usuários podem ver suas próprias assinaturas"
    ON public.premium_subscriptions
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Estabelecimentos podem ver seus assinantes"
    ON public.premium_subscriptions
    FOR ALL
    USING (
        EXISTS (
            SELECT 1
            FROM public.establishments
            WHERE id = establishment_id
            AND owner_id = auth.uid()
        )
    );

CREATE POLICY "Estabelecimentos podem atualizar seus assinantes"
    ON public.premium_subscriptions
    FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM public.establishments e 
        WHERE e.id = establishment_id 
        AND e.owner_id = auth.uid()
    ));

CREATE POLICY "Estabelecimentos podem remover seus assinantes"
    ON public.premium_subscriptions
    FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM public.establishments e 
        WHERE e.id = establishment_id 
        AND e.owner_id = auth.uid()
    ));

CREATE POLICY "Usuários podem criar suas próprias assinaturas"
    ON public.premium_subscriptions
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Função para verificar se um usuário é premium em um estabelecimento
CREATE OR REPLACE FUNCTION is_premium_subscriber(user_uuid UUID, establishment_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.premium_subscriptions
        WHERE user_id = user_uuid
        AND establishment_id = establishment_uuid
    );
END;
$$; 