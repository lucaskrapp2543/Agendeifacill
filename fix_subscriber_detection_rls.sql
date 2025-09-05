-- Corrigir políticas RLS para permitir detecção de assinantes por WhatsApp
-- Execute este SQL no Supabase SQL Editor

-- 1. Remover apenas a política que está bloqueando clientes
DROP POLICY IF EXISTS "Clients can view their own client subscriptions" ON client_subscriptions;

-- 2. Criar nova política que permite verificação de assinantes por WhatsApp
CREATE POLICY "Allow subscriber detection by WhatsApp" ON client_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    -- Permitir que estabelecimentos vejam suas próprias assinaturas
    establishment_id IN (SELECT id FROM establishments WHERE owner_id = auth.uid())
    OR
    -- Permitir que qualquer usuário autenticado verifique se um WhatsApp é assinante
    -- (necessário para detecção automática no agendamento)
    true
  );

-- 3. NÃO recriar a política de estabelecimentos (já existe e está funcionando)
-- A política "Establishments can manage their client subscriptions" já existe

-- 4. Verificar se as políticas foram criadas
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'client_subscriptions';
