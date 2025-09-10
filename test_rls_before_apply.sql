-- TESTE ANTES DE APLICAR - Execute este primeiro para ver o estado atual

-- 1. Ver quantas notificações existem atualmente
SELECT COUNT(*) as total_notifications FROM public.establishment_notifications;

-- 2. Ver se RLS está habilitado (deve ser false)
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'establishment_notifications';

-- 3. Ver se existem políticas (provavelmente nenhuma ou desabilitadas)
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'establishment_notifications';

-- 4. Testar se consegue acessar a tabela (deve funcionar)
SELECT COUNT(*) as accessible_notifications FROM public.establishment_notifications;
