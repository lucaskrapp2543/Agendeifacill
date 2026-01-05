-- Simplificar RLS para manual_clients
-- Permite que qualquer usuário autenticado possa gerenciar clientes
-- A restrição de acesso é feita por senha no sistema, não por RLS

-- 1. Remover política antiga (restritiva)
DROP POLICY IF EXISTS "Establishments can manage their own manual clients" ON manual_clients;

-- 2. Criar política simples: qualquer usuário autenticado pode gerenciar
CREATE POLICY "Authenticated users can manage manual clients"
ON manual_clients
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 3. Verificar se funcionou
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'manual_clients';

-- 4. Mensagem de sucesso
SELECT 'RLS simplificado - Qualquer usuário autenticado pode gerenciar clientes manuais' as status;

