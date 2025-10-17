-- REVERTER TODAS AS ALTERAÇÕES DO LIMITE MENSAL
-- Execute este SQL para limpar tudo e começar do zero

-- 1. REMOVER COLUNA monthly_service_limit da tabela subscriptions (se existir)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'subscriptions' 
        AND column_name = 'monthly_service_limit'
    ) THEN
        ALTER TABLE subscriptions DROP COLUMN monthly_service_limit;
        RAISE NOTICE '✅ Coluna monthly_service_limit removida da tabela subscriptions';
    ELSE
        RAISE NOTICE '⚠️ Coluna monthly_service_limit não existe na tabela subscriptions';
    END IF;
END $$;

-- 2. REMOVER COLUNA monthly_service_limit da tabela client_subscriptions (se existir)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'client_subscriptions' 
        AND column_name = 'monthly_service_limit'
    ) THEN
        ALTER TABLE client_subscriptions DROP COLUMN monthly_service_limit;
        RAISE NOTICE '✅ Coluna monthly_service_limit removida da tabela client_subscriptions';
    ELSE
        RAISE NOTICE '⚠️ Coluna monthly_service_limit não existe na tabela client_subscriptions';
    END IF;
END $$;

-- 3. VERIFICAR SE AS COLUNAS FORAM REMOVIDAS
SELECT 
    '=== VERIFICAÇÃO FINAL ===' as status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'subscriptions' AND column_name = 'monthly_service_limit'
        ) THEN '❌ AINDA EXISTE em subscriptions'
        ELSE '✅ REMOVIDA de subscriptions'
    END as subscriptions_status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'client_subscriptions' AND column_name = 'monthly_service_limit'
        ) THEN '❌ AINDA EXISTE em client_subscriptions'
        ELSE '✅ REMOVIDA de client_subscriptions'
    END as client_subscriptions_status;

-- 4. MOSTRAR MENSAGEM FINAL
SELECT 
    '🎯 TODAS AS ALTERAÇÕES DE LIMITE MENSAL FORAM REVERTIDAS!' as resultado,
    'Agora você pode começar do zero com uma abordagem mais simples.' as mensagem;
