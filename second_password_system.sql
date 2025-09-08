-- SISTEMA DE SEGUNDA SENHA RESERVA
-- Adicionar coluna para segunda senha na tabela establishments
ALTER TABLE establishments ADD COLUMN IF NOT EXISTS second_password TEXT;

-- Função para criar/atualizar segunda senha
CREATE OR REPLACE FUNCTION set_second_password(establishment_id UUID, second_password TEXT)
RETURNS JSONB AS $$
DECLARE
  establishment_record RECORD;
BEGIN
  -- Verificar se o estabelecimento existe
  SELECT id, name, code, owner_id
  INTO establishment_record
  FROM establishments
  WHERE id = establishment_id;

  IF establishment_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Estabelecimento não encontrado');
  END IF;

  -- Atualizar a segunda senha
  UPDATE establishments 
  SET second_password = second_password
  WHERE id = establishment_id;

  RETURN jsonb_build_object(
    'success', true,
    'establishment_id', establishment_id,
    'establishment_name', establishment_record.name,
    'second_password', second_password,
    'message', 'Segunda senha criada com sucesso'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para verificar login com segunda senha
CREATE OR REPLACE FUNCTION check_second_password_login(email TEXT, password TEXT)
RETURNS JSONB AS $$
DECLARE
  establishment_record RECORD;
  user_record RECORD;
BEGIN
  -- Buscar estabelecimento pela segunda senha
  SELECT e.id, e.name, e.code, e.owner_id, e.second_password, u.email, u.id as user_id
  INTO establishment_record
  FROM establishments e
  JOIN auth.users u ON e.owner_id = u.id
  WHERE u.email = email AND e.second_password = password;

  IF establishment_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Segunda senha inválida');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'establishment_id', establishment_record.id,
    'establishment_name', establishment_record.name,
    'establishment_code', establishment_record.code,
    'owner_email', establishment_record.email,
    'owner_id', establishment_record.user_id,
    'message', 'Login com segunda senha bem-sucedido'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Conceder permissões
GRANT EXECUTE ON FUNCTION set_second_password(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION set_second_password(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION check_second_password_login(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION check_second_password_login(TEXT, TEXT) TO authenticated;
