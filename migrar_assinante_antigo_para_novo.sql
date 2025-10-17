-- MIGRAR ASSINANTE DO SISTEMA ANTIGO PARA O NOVO
-- Este SQL migra um assinante de premium_subscriptions para client_subscriptions

-- 1. VERIFICAR se o assinante existe no sistema ANTIGO
SELECT 
    '=== SISTEMA ANTIGO (premium_subscriptions) ===' as info,
    id,
    establishment_id,
    whatsapp,
    subscription_id,
    start_date,
    end_date,
    created_at
FROM premium_subscriptions
WHERE whatsapp = '47999516123'
  AND establishment_id = 'fbba6634-e8f8-4e15-be17-e5a67ee7dea2';

-- 2. VERIFICAR se já existe no sistema NOVO
SELECT 
    '=== SISTEMA NOVO (client_subscriptions) ===' as info,
    id,
    establishment_id,
    client_whatsapp,
    subscription_id,
    start_date,
    end_date,
    monthly_limit,
    created_at
FROM client_subscriptions
WHERE client_whatsapp = '47999516123'
  AND establishment_id = 'fbba6634-e8f8-4e15-be17-e5a67ee7dea2';

-- 3. MIGRAR do sistema ANTIGO para o NOVO (se não existir no novo)
INSERT INTO client_subscriptions (
    establishment_id,
    client_id,
    client_whatsapp,
    subscription_id,
    start_date,
    end_date,
    payment_status,
    monthly_limit,
    created_at,
    updated_at
)
SELECT 
    ps.establishment_id,
    NULL as client_id, -- Será preenchido depois se necessário
    ps.whatsapp as client_whatsapp,
    ps.subscription_id,
    ps.start_date,
    ps.end_date,
    'paid' as payment_status,
    NULL as monthly_limit, -- Você define depois pelo botão "Limitar Cliente"
    ps.created_at,
    NOW() as updated_at
FROM premium_subscriptions ps
WHERE ps.whatsapp = '47999516123'
  AND ps.establishment_id = 'fbba6634-e8f8-4e15-be17-e5a67ee7dea2'
  AND NOT EXISTS (
    -- Não inserir se já existe no sistema novo
    SELECT 1 FROM client_subscriptions cs
    WHERE cs.client_whatsapp = ps.whatsapp
      AND cs.establishment_id = ps.establishment_id
  );

-- 4. VERIFICAR se a migração foi bem-sucedida
SELECT 
    '=== VERIFICAÇÃO FINAL ===' as info,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ ASSINANTE MIGRADO COM SUCESSO!'
        ELSE '❌ Nenhum assinante foi migrado (pode já existir no sistema novo)'
    END as resultado,
    COUNT(*) as total_no_sistema_novo
FROM client_subscriptions
WHERE client_whatsapp = '47999516123'
  AND establishment_id = 'fbba6634-e8f8-4e15-be17-e5a67ee7dea2';

-- 5. (OPCIONAL) APAGAR do sistema ANTIGO depois de migrar
-- DESCOMENTE as linhas abaixo SE quiser remover do sistema antigo:
/*
DELETE FROM premium_subscriptions
WHERE whatsapp = '47999516123'
  AND establishment_id = 'fbba6634-e8f8-4e15-be17-e5a67ee7dea2';

SELECT '✅ Removido do sistema antigo!' as resultado;
*/

