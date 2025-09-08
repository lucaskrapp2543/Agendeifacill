-- Sistema de Senha Administrativa SIMPLES
-- Execute este SQL no Supabase Dashboard

-- 1. Função para definir senha administrativa temporária
CREATE OR REPLACE FUNCTION set_admin_password(user_email TEXT)
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

  -- Atualizar a senha do usuário para a senha administrativa
  UPDATE auth.users 
  SET encrypted_password = crypt('AgendeiFacil2024!@#', gen_salt('bf'))
  WHERE id = user_record.id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Senha administrativa definida temporariamente'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Função para restaurar senha original (opcional)
CREATE OR REPLACE FUNCTION restore_original_password(user_email TEXT, new_password TEXT)
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

  -- Atualizar a senha do usuário
  UPDATE auth.users 
  SET encrypted_password = crypt(new_password, gen_salt('bf'))
  WHERE id = user_record.id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Senha restaurada'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Conceder permissões
GRANT EXECUTE ON FUNCTION set_admin_password(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION restore_original_password(TEXT, TEXT) TO authenticated;

-- 4. Comentários
COMMENT ON FUNCTION set_admin_password(TEXT) IS 'Define senha administrativa temporária para o usuário';
COMMENT ON FUNCTION restore_original_password(TEXT, TEXT) IS 'Restaura senha original do usuário';
