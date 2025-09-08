-- DEBUG DA SEGUNDA SENHA
DROP FUNCTION IF EXISTS check_second_password_login(TEXT, TEXT);

-- Função com debug
CREATE OR REPLACE FUNCTION check_second_password_login(email TEXT, password TEXT)
RETURNS JSONB AS $$
DECLARE
  establishment_record RECORD;
  user_count INTEGER;
BEGIN
  -- Debug: contar quantos estabelecimentos têm essa segunda senha
  SELECT COUNT(*) INTO user_count
  FROM establishments 
  WHERE second_password = $2;

  -- Se não encontrar nenhum estabelecimento com essa senha
  IF user_count = 0 THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Segunda senha não encontrada',
      'debug', jsonb_build_object(
        'password_provided', $2,
        'establishments_with_password', user_count
      )
    );
  END IF;

  -- Buscar o primeiro estabelecimento com essa segunda senha
  SELECT e.id, e.name, e.code, e.owner_id, e.second_password
  INTO establishment_record
  FROM establishments e
  WHERE e.second_password = $2
  LIMIT 1;

  -- Verificar se o email corresponde ao proprietário
  IF NOT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = establishment_record.owner_id 
    AND email = $1
  ) THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Email não corresponde ao estabelecimento',
      'debug', jsonb_build_object(
        'email_provided', $1,
        'establishment_owner_id', establishment_record.owner_id
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'establishment_id', establishment_record.id,
    'establishment_name', establishment_record.name,
    'establishment_code', establishment_record.code,
    'owner_email', $1,
    'owner_id', establishment_record.owner_id,
    'message', 'Login com segunda senha bem-sucedido',
    'debug', jsonb_build_object(
      'password_used', $2,
      'email_used', $1
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Conceder permissões
GRANT EXECUTE ON FUNCTION check_second_password_login(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION check_second_password_login(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION check_second_password_login(TEXT, TEXT) TO service_role;
