-- CORRIGIR RLS para registration_forms
-- O problema está nas políticas que tentam acessar auth.users

-- Remover políticas antigas
DROP POLICY IF EXISTS "Admins can view all registration forms" ON registration_forms;
DROP POLICY IF EXISTS "Anyone can insert registration forms" ON registration_forms;

-- Política simplificada para SELECT - permitir apenas para admins específicos
CREATE POLICY "Admins can view registration forms" ON registration_forms
  FOR SELECT USING (
    auth.jwt() ->> 'email' IN ('admin@agendeifacil.com', 'felipe@agendeifacil.com')
  );

-- Política para INSERT - qualquer usuário pode inserir
CREATE POLICY "Anyone can insert registration forms" ON registration_forms
  FOR INSERT WITH CHECK (true);

-- Política para UPDATE - apenas admins podem atualizar
CREATE POLICY "Admins can update registration forms" ON registration_forms
  FOR UPDATE USING (
    auth.jwt() ->> 'email' IN ('admin@agendeifacil.com', 'felipe@agendeifacil.com')
  );

-- Política para DELETE - apenas admins podem deletar
CREATE POLICY "Admins can delete registration forms" ON registration_forms
  FOR DELETE USING (
    auth.jwt() ->> 'email' IN ('admin@agendeifacil.com', 'felipe@agendeifacil.com')
  );

-- Comentários atualizados
COMMENT ON POLICY "Admins can view registration forms" ON registration_forms IS 'Permite que apenas admins vejam os prontuários';
COMMENT ON POLICY "Anyone can insert registration forms" ON registration_forms IS 'Permite que qualquer usuário envie formulários';
COMMENT ON POLICY "Admins can update registration forms" ON registration_forms IS 'Permite que apenas admins atualizem status';
COMMENT ON POLICY "Admins can delete registration forms" ON registration_forms IS 'Permite que apenas admins excluam prontuários';
