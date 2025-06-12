-- Permitir acesso público aos estabelecimentos para visualização
-- Isso resolve o erro 406 "Not Acceptable" que ocorre quando usuários não logados tentam acessar páginas de estabelecimentos

-- Remover política restritiva existente
DROP POLICY IF EXISTS "Public can view establishment details" ON establishments;
DROP POLICY IF EXISTS "All users can view establishments" ON establishments;
DROP POLICY IF EXISTS "Owners can manage their establishments" ON establishments;

-- Criar nova política que permite acesso público (anônimo e autenticado) para leitura
CREATE POLICY "Public and authenticated can view establishments"
ON establishments
FOR SELECT
TO anon, authenticated
USING (true);

-- Manter política para proprietários gerenciarem seus estabelecimentos  
CREATE POLICY "Owners can manage their establishments"
ON establishments
FOR ALL
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- Conceder permissões explícitas para usuários anônimos lerem estabelecimentos
GRANT SELECT ON establishments TO anon;

-- Comentário explicativo
COMMENT ON POLICY "Public and authenticated can view establishments" ON establishments IS 
'Permite que qualquer pessoa (logada ou não) visualize informações dos estabelecimentos. Necessário para páginas públicas de agendamento.'; 