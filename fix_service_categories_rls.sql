-- Simplificar RLS para service_categories e service_subcategories
-- Permite que qualquer usuário autenticado possa gerenciar serviços
-- A restrição de acesso é feita por senha no sistema, não por RLS

-- 1. Remover políticas antigas (restritivas)
DROP POLICY IF EXISTS "Establishments can manage their service categories" ON service_categories;
DROP POLICY IF EXISTS "Establishments can manage their service subcategories" ON service_subcategories;

-- 2. Criar políticas simples: qualquer usuário autenticado pode gerenciar
CREATE POLICY "Authenticated users can manage service categories"
ON service_categories
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can manage service subcategories"
ON service_subcategories
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
WHERE tablename IN ('service_categories', 'service_subcategories');

-- 4. Mensagem de sucesso
SELECT 'RLS simplificado - Qualquer usuário autenticado pode gerenciar serviços' as status;

