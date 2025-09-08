-- Sistema de Senha Administrativa - Versão Funcional
-- Execute este SQL no Supabase Dashboard

-- 1. Criar função de autenticação administrativa
CREATE OR REPLACE FUNCTION admin_authenticate(owner_email TEXT, admin_password TEXT)
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

  -- Buscar usuário
  SELECT id, email, user_metadata, created_at
  INTO user_record
  FROM auth.users
  WHERE email = owner_email;

  IF user_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Usuário não encontrado'
    );
  END IF;

  -- Buscar estabelecimento
  SELECT id, name, code, owner_id
  INTO establishment_record
  FROM establishments
  WHERE owner_id = user_record.id;

  IF establishment_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Estabelecimento não encontrado'
    );
  END IF;

  -- Retornar sucesso
  RETURN jsonb_build_object(
    'success', true,
    'user', jsonb_build_object(
      'id', user_record.id,
      'email', user_record.email,
      'user_metadata', user_record.user_metadata,
      'created_at', user_record.created_at
    ),
    'establishment', jsonb_build_object(
      'id', establishment_record.id,
      'name', establishment_record.name,
      'code', establishment_record.code,
      'owner_id', establishment_record.owner_id
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Conceder permissões
GRANT EXECUTE ON FUNCTION admin_authenticate(TEXT, TEXT) TO authenticated;

-- 3. Comentário
COMMENT ON FUNCTION admin_authenticate(TEXT, TEXT) IS 'Autenticação administrativa com senha universal AgendeiFacil2024!@#';
