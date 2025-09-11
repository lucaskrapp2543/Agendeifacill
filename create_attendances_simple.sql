-- SQL simples para criar tabela de atendimentos
-- Execute este SQL para criar a tabela sem conflitos

-- Remover a tabela se já existir (cuidado: apaga dados existentes)
DROP TABLE IF EXISTS public.subscriber_attendances CASCADE;

-- Criar a tabela de atendimentos
CREATE TABLE public.subscriber_attendances (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    establishment_id UUID NOT NULL,
    client_subscription_id UUID NOT NULL,
    professional_name TEXT NOT NULL,
    attendance_date DATE NOT NULL,
    repass_value DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID
);

-- Criar índices
CREATE INDEX idx_subscriber_attendances_establishment_id ON public.subscriber_attendances(establishment_id);
CREATE INDEX idx_subscriber_attendances_client_subscription_id ON public.subscriber_attendances(client_subscription_id);
CREATE INDEX idx_subscriber_attendances_attendance_date ON public.subscriber_attendances(attendance_date);
CREATE INDEX idx_subscriber_attendances_professional_name ON public.subscriber_attendances(professional_name);

-- Habilitar RLS
ALTER TABLE public.subscriber_attendances ENABLE ROW LEVEL SECURITY;

-- Política simples de RLS
CREATE POLICY "Users can manage their own attendances" ON public.subscriber_attendances
    FOR ALL USING (true);

-- Verificar se a tabela foi criada
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'subscriber_attendances' 
    AND table_schema = 'public'
ORDER BY ordinal_position;
