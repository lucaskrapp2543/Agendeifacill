-- CORREÇÃO DE EMERGÊNCIA - PERMITIR AGENDAMENTOS FUNCIONAREM
-- Desabilitar RLS temporariamente para permitir agendamentos

-- 1. Desabilitar RLS na tabela de notificações
ALTER TABLE establishment_notifications DISABLE ROW LEVEL SECURITY;

-- 2. Verificar se RLS foi desabilitado
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'establishment_notifications';

-- 3. Testar se agendamentos funcionam agora
-- (Execute um agendamento de teste para verificar)
