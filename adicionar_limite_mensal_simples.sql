-- ADICIONAR LIMITE MENSAL SIMPLES
-- Execute este SQL para adicionar a funcionalidade de limite

-- 1. ADICIONAR COLUNA monthly_limit na tabela client_subscriptions
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'client_subscriptions' 
        AND column_name = 'monthly_limit'
    ) THEN
        ALTER TABLE client_subscriptions 
        ADD COLUMN monthly_limit INTEGER DEFAULT NULL;
        
        COMMENT ON COLUMN client_subscriptions.monthly_limit IS 'Limite de agendamentos por mês para este cliente (NULL = sem limite)';
        
        RAISE NOTICE '✅ Coluna monthly_limit adicionada com sucesso!';
    ELSE
        RAISE NOTICE '⚠️ Coluna monthly_limit já existe, pulando...';
    END IF;
END $$;

-- 2. VERIFICAR SE FOI ADICIONADA
SELECT 
    '=== VERIFICAÇÃO ===' as status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'client_subscriptions' AND column_name = 'monthly_limit'
        ) THEN '✅ COLUNA monthly_limit ADICIONADA!'
        ELSE '❌ ERRO: Coluna não foi adicionada'
    END as resultado;

-- 3. MOSTRAR ESTRUTURA DA TABELA
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'client_subscriptions' 
AND column_name = 'monthly_limit';
