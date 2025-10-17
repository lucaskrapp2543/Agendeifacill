-- ADICIONAR CAMPO LIMITE MENSAL NA TABELA client_subscriptions
-- Execute este SQL no Supabase SQL Editor

-- 1. Verificar se a coluna já existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'client_subscriptions' 
        AND column_name = 'monthly_service_limit'
    ) THEN
        -- 2. ADICIONAR coluna monthly_service_limit na tabela client_subscriptions
        ALTER TABLE client_subscriptions 
        ADD COLUMN monthly_service_limit INTEGER DEFAULT 999;
        
        -- 3. COMENTÁRIO na coluna
        COMMENT ON COLUMN client_subscriptions.monthly_service_limit IS 'Limite de serviços por mês para este cliente específico (999=sem limite, 1-20=limite específico)';
        
        RAISE NOTICE '✅ Campo monthly_service_limit adicionado na tabela client_subscriptions!';
    ELSE
        RAISE NOTICE '⚠️ Campo monthly_service_limit já existe na tabela client_subscriptions, pulando...';
    END IF;
END $$;

-- 4. VERIFICAR se foi adicionado corretamente
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'client_subscriptions' 
AND column_name = 'monthly_service_limit';

-- 5. VERIFICAR dados existentes (SEM ALTERAR NADA)
SELECT 
    COUNT(*) as total_client_subscriptions,
    COUNT(CASE WHEN monthly_service_limit IS NULL THEN 1 END) as com_null,
    COUNT(CASE WHEN monthly_service_limit = 999 THEN 1 END) as sem_limite,
    COUNT(CASE WHEN monthly_service_limit BETWEEN 1 AND 20 THEN 1 END) as com_limite
FROM client_subscriptions;

-- 6. MOSTRAR algumas client_subscriptions existentes (APENAS LEITURA)
SELECT 
    cs.id,
    cs.client_id,
    cs.monthly_service_limit,
    cs.created_at,
    s.name as subscription_name
FROM client_subscriptions cs
LEFT JOIN subscriptions s ON cs.subscription_id = s.id
ORDER BY cs.created_at DESC
LIMIT 5;

-- ✅ SEGURANÇA TOTAL:
-- - Não altera dados existentes
-- - Apenas adiciona o campo com valor padrão 999 (sem limite)
-- - Assinaturas existentes continuam funcionando normalmente
-- - Profissional pode definir limite individual por cliente
