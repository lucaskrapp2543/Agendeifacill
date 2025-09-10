-- Script SIMPLIFICADO para corrigir problemas de RLS na tabela establishment_notifications
-- Execute este script no SQL Editor do Supabase

-- 1. Verificar o estado atual da tabela
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'establishment_notifications';

-- 2. Verificar se existem políticas criadas
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'establishment_notifications';

-- 3. HABILITAR RLS na tabela establishment_notifications
ALTER TABLE public.establishment_notifications ENABLE ROW LEVEL SECURITY;

-- 4. Remover políticas antigas se existirem (para evitar conflitos)
DROP POLICY IF EXISTS "Estabelecimentos podem ver suas notificações" ON public.establishment_notifications;
DROP POLICY IF EXISTS "Estabelecimentos podem inserir suas notificações" ON public.establishment_notifications;
DROP POLICY IF EXISTS "Estabelecimentos podem atualizar suas notificações" ON public.establishment_notifications;
DROP POLICY IF EXISTS "Estabelecimentos podem deletar suas notificações" ON public.establishment_notifications;

-- 5. Criar política para SELECT (visualizar)
CREATE POLICY "Estabelecimentos podem ver suas notificações" ON public.establishment_notifications
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM establishments
            WHERE establishments.id = establishment_notifications.establishment_id
            AND establishments.owner_id = auth.uid()
        )
    );

-- 6. Criar política para INSERT (inserir)
CREATE POLICY "Estabelecimentos podem inserir suas notificações" ON public.establishment_notifications
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM establishments
            WHERE establishments.id = establishment_notifications.establishment_id
            AND establishments.owner_id = auth.uid()
        )
    );

-- 7. Criar política para UPDATE (atualizar)
CREATE POLICY "Estabelecimentos podem atualizar suas notificações" ON public.establishment_notifications
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1
            FROM establishments
            WHERE establishments.id = establishment_notifications.establishment_id
            AND establishments.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM establishments
            WHERE establishments.id = establishment_notifications.establishment_id
            AND establishments.owner_id = auth.uid()
        )
    );

-- 8. Criar política para DELETE (deletar)
CREATE POLICY "Estabelecimentos podem deletar suas notificações" ON public.establishment_notifications
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1
            FROM establishments
            WHERE establishments.id = establishment_notifications.establishment_id
            AND establishments.owner_id = auth.uid()
        )
    );

-- 9. Verificar se as políticas foram criadas corretamente
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'establishment_notifications'
ORDER BY policyname;

-- 10. Verificar se RLS está habilitado
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'establishment_notifications';

-- 11. Mensagem de sucesso
SELECT 'RLS configurado com sucesso para establishment_notifications!' as status;
