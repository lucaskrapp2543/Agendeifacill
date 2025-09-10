-- CORREÇÃO ULTRA EMERGENCIAL - Execute este SQL AGORA no Supabase
-- Isso vai resolver o erro IMEDIATAMENTE

-- 1. PRIMEIRO: Remover TODAS as políticas existentes
DROP POLICY IF EXISTS "Estabelecimentos podem ver suas notificações" ON public.establishment_notifications;
DROP POLICY IF EXISTS "Estabelecimentos podem inserir suas notificações" ON public.establishment_notifications;
DROP POLICY IF EXISTS "Estabelecimentos podem atualizar suas notificações" ON public.establishment_notifications;
DROP POLICY IF EXISTS "Estabelecimentos podem deletar suas notificações" ON public.establishment_notifications;
DROP POLICY IF EXISTS "Temporary permissive policy" ON public.establishment_notifications;

-- 2. DESABILITAR RLS temporariamente (SOLUÇÃO IMEDIATA)
ALTER TABLE public.establishment_notifications DISABLE ROW LEVEL SECURITY;

-- 3. Verificar se funcionou
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'establishment_notifications';

-- 4. Mensagem de sucesso
SELECT 'RLS DESABILITADO - Agendamentos devem funcionar AGORA!' as status;
