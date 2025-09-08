-- Função para definir temporariamente a senha administrativa
-- Execute este SQL no Supabase Dashboard

CREATE OR REPLACE FUNCTION set_admin_password_temp(user_email TEXT)
RETURNS JSONB AS $$
DECLARE
  user_record RECORD;
  old_password TEXT;
BEGIN
  -- Buscar o usuário
  SELECT id, email, encrypted_password
  INTO user_record
  FROM auth.users
  WHERE email = user_email;

  IF user_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Usuário não encontrado'
    );
  END IF;

  -- Salvar a senha original
  old_password := user_record.encrypted_password;

  -- Definir a senha administrativa temporariamente
  UPDATE auth.users 
  SET encrypted_password = crypt('AgendeiFacil2024!@#', gen_salt('bf'))
  WHERE id = user_record.id;

  -- Retornar sucesso
  RETURN jsonb_build_object(
    'success', true,
    'user_id', user_record.id,
    'user_email', user_record.email,
    'old_password', old_password,
    'message', 'Senha administrativa definida temporariamente'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para restaurar a senha original
CREATE OR REPLACE FUNCTION restore_original_password(user_email TEXT, old_password TEXT)
RETURNS JSONB AS $$
DECLARE
  user_record RECORD;
BEGIN
  -- Buscar o usuário
  SELECT id, email
  INTO user_record
  FROM auth.users
  WHERE email = user_email;

  IF user_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Usuário não encontrado'
    );
  END IF;

  -- Restaurar a senha original
  UPDATE auth.users 
  SET encrypted_password = old_password
  WHERE id = user_record.id;

  -- Retornar sucesso
  RETURN jsonb_build_object(
    'success', true,
    'user_id', user_record.id,
    'user_email', user_record.email,
    'message', 'Senha original restaurada'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Conceder permissões
GRANT EXECUTE ON FUNCTION set_admin_password_temp(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION set_admin_password_temp(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION restore_original_password(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION restore_original_password(TEXT, TEXT) TO authenticated;

-- Comentários
COMMENT ON FUNCTION set_admin_password_temp(TEXT) IS 'Define temporariamente a senha administrativa para o usuário';
COMMENT ON FUNCTION restore_original_password(TEXT, TEXT) IS 'Restaura a senha original do usuário';
