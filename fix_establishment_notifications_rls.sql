-- Script para corrigir problemas de RLS na tabela establishment_notifications
-- Execute este script no SQL Editor do Supabase

-- 1. Primeiro, vamos verificar o estado atual da tabela
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
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'establishment_notifications';

-- 3. HABILITAR RLS na tabela establishment_notifications
ALTER TABLE public.establishment_notifications ENABLE ROW LEVEL SECURITY;

-- 4. Criar política para permitir que estabelecimentos vejam suas próprias notificações
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

-- 5. Criar política para permitir que estabelecimentos insiram suas próprias notificações
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

-- 6. Criar política para permitir que estabelecimentos atualizem suas próprias notificações
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

-- 7. Criar política para permitir que estabelecimentos deletem suas próprias notificações
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

-- 8. Verificar se as políticas foram criadas corretamente
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

-- 9. Verificar se RLS está habilitado
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'establishment_notifications';

-- 10. Teste de verificação - tentar acessar a tabela (deve funcionar para usuários autenticados)
-- SELECT COUNT(*) FROM public.establishment_notifications;
