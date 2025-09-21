-- CORRIGIR RLS para registration_forms com email correto
-- Email correto do admin: suporteagendeifacil@gmail.com

-- Remover políticas antigas
DROP POLICY IF EXISTS "Admins can view all registration forms" ON registration_forms;
DROP POLICY IF EXISTS "Anyone can insert registration forms" ON registration_forms;
DROP POLICY IF EXISTS "Admins can view registration forms" ON registration_forms;
DROP POLICY IF EXISTS "Admins can update registration forms" ON registration_forms;
DROP POLICY IF EXISTS "Admins can delete registration forms" ON registration_forms;

-- Política simplificada para SELECT - permitir apenas para admin correto
CREATE POLICY "Admins can view registration forms" ON registration_forms
  FOR SELECT USING (
    auth.jwt() ->> 'email' = 'suporteagendeifacil@gmail.com'
  );

-- Política para INSERT - qualquer usuário pode inserir
CREATE POLICY "Anyone can insert registration forms" ON registration_forms
  FOR INSERT WITH CHECK (true);

-- Política para UPDATE - apenas admin pode atualizar
CREATE POLICY "Admins can update registration forms" ON registration_forms
  FOR UPDATE USING (
    auth.jwt() ->> 'email' = 'suporteagendeifacil@gmail.com'
  );

-- Política para DELETE - apenas admin pode deletar
CREATE POLICY "Admins can delete registration forms" ON registration_forms
  FOR DELETE USING (
    auth.jwt() ->> 'email' = 'suporteagendeifacil@gmail.com'
  );

-- Comentários atualizados
COMMENT ON POLICY "Admins can view registration forms" ON registration_forms IS 'Permite que apenas suporteagendeifacil@gmail.com veja os prontuários';
COMMENT ON POLICY "Anyone can insert registration forms" ON registration_forms IS 'Permite que qualquer usuário envie formulários';
COMMENT ON POLICY "Admins can update registration forms" ON registration_forms IS 'Permite que apenas admin atualize status';
COMMENT ON POLICY "Admins can delete registration forms" ON registration_forms IS 'Permite que apenas admin exclua prontuários';
