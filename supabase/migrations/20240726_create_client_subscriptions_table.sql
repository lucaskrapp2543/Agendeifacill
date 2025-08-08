-- CRIAR TABELA client_subscriptions DO ZERO
-- Execute este script no SQL Editor do Supabase

-- 1. Criar a tabela client_subscriptions
CREATE TABLE IF NOT EXISTS client_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id TEXT NOT NULL,
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    establishment_id UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('paid', 'unpaid')),
    last_payment_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_client_subscriptions_client_id ON client_subscriptions(client_id);
CREATE INDEX IF NOT EXISTS idx_client_subscriptions_establishment_id ON client_subscriptions(establishment_id);
CREATE INDEX IF NOT EXISTS idx_client_subscriptions_subscription_id ON client_subscriptions(subscription_id);

-- 3. Habilitar RLS
ALTER TABLE client_subscriptions ENABLE ROW LEVEL SECURITY;

-- 4. Criar policies
CREATE POLICY "Establishments can manage their client subscriptions" ON client_subscriptions FOR ALL USING (establishment_id IN (SELECT id FROM establishments WHERE owner_id = auth.uid()));

-- 5. Verificar se foi criada
SELECT table_name FROM information_schema.tables WHERE table_name = 'client_subscriptions'; 