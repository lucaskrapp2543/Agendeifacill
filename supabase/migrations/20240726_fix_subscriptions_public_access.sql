-- Permitir acesso público às assinaturas para que apareçam no booking sem login
-- Remover a política restritiva e criar uma nova que permite acesso público

-- Remover a política restritiva existente
DROP POLICY IF EXISTS "Clients can view subscriptions" ON subscriptions;

-- Criar nova política que permite acesso público às assinaturas
CREATE POLICY "Public can view subscriptions"
  ON subscriptions
  FOR SELECT
  USING (true);

-- Comentário explicativo
COMMENT ON POLICY "Public can view subscriptions" ON subscriptions IS 'Permite que qualquer pessoa veja as assinaturas disponíveis no booking, mesmo sem estar logada'; 