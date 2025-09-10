-- ROLLBACK - Use este SQL se algo der errado para desfazer as mudanças

-- 1. Remover todas as políticas criadas
DROP POLICY IF EXISTS "Estabelecimentos podem ver suas notificações" ON public.establishment_notifications;
DROP POLICY IF EXISTS "Estabelecimentos podem inserir suas notificações" ON public.establishment_notifications;
DROP POLICY IF EXISTS "Estabelecimentos podem atualizar suas notificações" ON public.establishment_notifications;
DROP POLICY IF EXISTS "Estabelecimentos podem deletar suas notificações" ON public.establishment_notifications;

-- 2. Desabilitar RLS (volta ao estado anterior)
ALTER TABLE public.establishment_notifications DISABLE ROW LEVEL SECURITY;

-- 3. Verificar se voltou ao estado anterior
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'establishment_notifications';

-- 4. Mensagem de rollback
SELECT 'Rollback realizado - tabela voltou ao estado anterior!' as status;
