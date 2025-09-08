-- Função SIMPLES e ROBUSTA para verificar usuário
-- Execute este SQL no Supabase Dashboard

-- Remover função anterior
DROP FUNCTION IF EXISTS discover_user_password(TEXT);

-- Criar função simples
CREATE OR REPLACE FUNCTION check_user_simple(user_email TEXT)
RETURNS JSONB AS $$
DECLARE
  user_record RECORD;
  establishment_record RECORD;
BEGIN
  -- Buscar o usuário
  SELECT id, email, encrypted_password, created_at
  INTO user_record
  FROM auth.users
  WHERE email = user_email;

  IF user_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Usuário não encontrado'
    );
  END IF;

  -- Buscar o estabelecimento (se existir)
  SELECT id, name, code
  INTO establishment_record
  FROM establishments
  WHERE owner_id = user_record.id;

  -- Retornar informações básicas
  RETURN jsonb_build_object(
    'success', true,
    'user_id', user_record.id,
    'user_email', user_record.email,
    'encrypted_password', user_record.encrypted_password,
    'created_at', user_record.created_at,
    'has_establishment', establishment_record IS NOT NULL,
    'establishment_id', COALESCE(establishment_record.id::text, ''),
    'establishment_name', COALESCE(establishment_record.name, ''),
    'establishment_code', COALESCE(establishment_record.code, ''),
    'message', 'Usuário encontrado com sucesso'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Conceder permissões
GRANT EXECUTE ON FUNCTION check_user_simple(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION check_user_simple(TEXT) TO authenticated;

-- Comentário
COMMENT ON FUNCTION check_user_simple(TEXT) IS 'Função simples para verificar usuário e mostrar senha criptografada';
