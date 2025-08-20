-- CORRIGIR POLÍTICAS RLS DAS NOTIFICAÇÕES
-- O problema é que as políticas estão muito restritivas

-- 1. Remover políticas antigas
DROP POLICY IF EXISTS "Estabelecimentos podem ver suas notificações" ON establishment_notifications;
DROP POLICY IF EXISTS "Estabelecimentos podem inserir suas notificações" ON establishment_notifications;
DROP POLICY IF EXISTS "Estabelecimentos podem atualizar suas notificações" ON establishment_notifications;
DROP POLICY IF EXISTS "Estabelecimentos podem deletar suas notificações" ON establishment_notifications;

-- 2. Criar políticas mais permissivas
-- Política para SELECT - permitir que estabelecimentos vejam suas notificações
CREATE POLICY "enable_select_for_establishments" ON establishment_notifications
    FOR SELECT
    USING (true);

-- Política para INSERT - permitir inserção de notificações
CREATE POLICY "enable_insert_for_notifications" ON establishment_notifications
    FOR INSERT
    WITH CHECK (true);

-- Política para UPDATE - permitir atualização de notificações
CREATE POLICY "enable_update_for_notifications" ON establishment_notifications
    FOR UPDATE
    USING (true);

-- Política para DELETE - permitir exclusão de notificações
CREATE POLICY "enable_delete_for_notifications" ON establishment_notifications
    FOR DELETE
    USING (true);

-- 3. Verificar se as políticas foram criadas
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'establishment_notifications';
