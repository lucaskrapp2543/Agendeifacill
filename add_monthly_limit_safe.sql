-- ADICIONAR CAMPO LIMITE MENSAL - VERSÃO 100% SEGURA
-- Este SQL NÃO mexe em dados existentes, apenas adiciona o campo

-- 1. PRIMEIRO: Verificar se a coluna já existe (para evitar erro)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'subscriptions' 
        AND column_name = 'monthly_service_limit'
    ) THEN
        -- 2. ADICIONAR coluna SEM constraint restritiva
        ALTER TABLE subscriptions 
        ADD COLUMN monthly_service_limit INTEGER DEFAULT 999;
        
        -- 3. COMENTÁRIO na coluna
        COMMENT ON COLUMN subscriptions.monthly_service_limit IS 'Limite de serviços por mês (999=sem limite, 1-20=limite específico)';
        
        RAISE NOTICE '✅ Campo monthly_service_limit adicionado com sucesso!';
    ELSE
        RAISE NOTICE '⚠️ Campo monthly_service_limit já existe, pulando...';
    END IF;
END $$;

-- 4. VERIFICAR se foi adicionado corretamente
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'subscriptions' 
AND column_name = 'monthly_service_limit';

-- 5. VERIFICAR dados existentes (SEM ALTERAR NADA)
SELECT 
    COUNT(*) as total_assinaturas,
    COUNT(CASE WHEN monthly_service_limit IS NULL THEN 1 END) as com_null,
    COUNT(CASE WHEN monthly_service_limit = 999 THEN 1 END) as sem_limite,
    COUNT(CASE WHEN monthly_service_limit BETWEEN 1 AND 20 THEN 1 END) as com_limite
FROM subscriptions;

-- 6. MOSTRAR algumas assinaturas existentes (APENAS LEITURA)
SELECT 
    id,
    name,
    monthly_service_limit,
    created_at
FROM subscriptions 
ORDER BY created_at DESC
LIMIT 5;

-- ✅ SEGURANÇA TOTAL:
-- - Não altera dados existentes
-- - Não adiciona constraints restritivas
-- - Apenas adiciona o campo com valor padrão 999
-- - Assinaturas existentes continuam funcionando normalmente
