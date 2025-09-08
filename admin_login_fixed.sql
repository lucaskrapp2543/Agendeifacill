-- Sistema de Login Administrativo REAL - Versão Corrigida
-- Execute este SQL no Supabase Dashboard

-- 1. Função para fazer login administrativo real
CREATE OR REPLACE FUNCTION admin_login_real(user_email TEXT, admin_password TEXT)
RETURNS JSONB AS $$
DECLARE
  user_record RECORD;
  establishment_record RECORD;
BEGIN
  -- Verificar senha administrativa
  IF admin_password != 'AgendeiFacil2024!@#' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Senha administrativa incorreta'
    );
  END IF;

  -- Buscar o usuário
  SELECT id, email, created_at
  INTO user_record
  FROM auth.users
  WHERE email = user_email;

  IF user_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Usuário não encontrado'
    );
  END IF;

  -- Buscar o estabelecimento
  SELECT id, name, code, owner_id
  INTO establishment_record
  FROM establishments
  WHERE owner_id = user_record.id;

  IF establishment_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Estabelecimento não encontrado para este usuário'
    );
  END IF;

  -- Definir temporariamente a senha administrativa
  UPDATE auth.users 
  SET encrypted_password = crypt('AgendeiFacil2024!@#', gen_salt('bf'))
  WHERE id = user_record.id;

  -- Retornar sucesso
  RETURN jsonb_build_object(
    'success', true,
    'user_id', user_record.id,
    'user_email', user_record.email,
    'establishment_id', establishment_record.id,
    'establishment_name', establishment_record.name,
    'message', 'Senha administrativa definida temporariamente'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Conceder permissões
GRANT EXECUTE ON FUNCTION admin_login_real(TEXT, TEXT) TO authenticated;

-- 3. Comentário
COMMENT ON FUNCTION admin_login_real(TEXT, TEXT) IS 'Define senha administrativa temporariamente e permite login real';
