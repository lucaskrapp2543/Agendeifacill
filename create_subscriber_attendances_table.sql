-- Script para criar tabela de atendimentos de assinantes
-- Esta tabela armazenará os atendimentos adicionados manualmente pelos profissionais

CREATE TABLE IF NOT EXISTS public.subscriber_attendances (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
    client_subscription_id UUID NOT NULL REFERENCES public.client_subscriptions(id) ON DELETE CASCADE,
    professional_name TEXT NOT NULL,
    attendance_date DATE NOT NULL,
    repass_value DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    -- Índices para melhor performance
    CONSTRAINT subscriber_attendances_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(id) ON DELETE CASCADE,
    CONSTRAINT subscriber_attendances_client_subscription_id_fkey FOREIGN KEY (client_subscription_id) REFERENCES public.client_subscriptions(id) ON DELETE CASCADE
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_subscriber_attendances_establishment_id ON public.subscriber_attendances(establishment_id);
CREATE INDEX IF NOT EXISTS idx_subscriber_attendances_client_subscription_id ON public.subscriber_attendances(client_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriber_attendances_attendance_date ON public.subscriber_attendances(attendance_date);
CREATE INDEX IF NOT EXISTS idx_subscriber_attendances_professional_name ON public.subscriber_attendances(professional_name);

-- Comentários para documentação
COMMENT ON TABLE public.subscriber_attendances IS 'Tabela para armazenar atendimentos de assinantes adicionados manualmente pelos profissionais';
COMMENT ON COLUMN public.subscriber_attendances.establishment_id IS 'ID do estabelecimento';
COMMENT ON COLUMN public.subscriber_attendances.client_subscription_id IS 'ID da assinatura do cliente';
COMMENT ON COLUMN public.subscriber_attendances.professional_name IS 'Nome do profissional que atendeu';
COMMENT ON COLUMN public.subscriber_attendances.attendance_date IS 'Data do atendimento';
COMMENT ON COLUMN public.subscriber_attendances.repass_value IS 'Valor repassado ao profissional';
COMMENT ON COLUMN public.subscriber_attendances.created_at IS 'Data de criação do registro';
COMMENT ON COLUMN public.subscriber_attendances.created_by IS 'ID do usuário que criou o registro';

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.subscriber_attendances ENABLE ROW LEVEL SECURITY;

-- Política de RLS: usuários só podem ver/editar atendimentos do seu estabelecimento
CREATE POLICY "Users can view subscriber attendances from their establishment" ON public.subscriber_attendances
    FOR SELECT USING (
        establishment_id IN (
            SELECT id FROM public.establishments 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert subscriber attendances to their establishment" ON public.subscriber_attendances
    FOR INSERT WITH CHECK (
        establishment_id IN (
            SELECT id FROM public.establishments 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update subscriber attendances from their establishment" ON public.subscriber_attendances
    FOR UPDATE USING (
        establishment_id IN (
            SELECT id FROM public.establishments 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete subscriber attendances from their establishment" ON public.subscriber_attendances
    FOR DELETE USING (
        establishment_id IN (
            SELECT id FROM public.establishments 
            WHERE user_id = auth.uid()
        )
    );
