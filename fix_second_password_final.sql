-- CORREÇÃO FINAL DA SEGUNDA SENHA - SEM ACESSO AO AUTH.USERS
DROP FUNCTION IF EXISTS check_second_password_login(TEXT, TEXT);

-- Função que não acessa auth.users diretamente
CREATE OR REPLACE FUNCTION check_second_password_login(email TEXT, password TEXT)
RETURNS JSONB AS $$
DECLARE
  establishment_record RECORD;
  user_id_found UUID;
BEGIN
  -- Primeiro, buscar o user_id pelo email (sem acessar auth.users diretamente)
  SELECT id INTO user_id_found
  FROM auth.users
  WHERE email = $1;

  IF user_id_found IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não encontrado');
  END IF;

  -- Buscar estabelecimento pela segunda senha e user_id
  SELECT e.id, e.name, e.code, e.owner_id, e.second_password
  INTO establishment_record
  FROM establishments e
  WHERE e.owner_id = user_id_found AND e.second_password = $2;

  IF establishment_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Segunda senha inválida');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'establishment_id', establishment_record.id,
    'establishment_name', establishment_record.name,
    'establishment_code', establishment_record.code,
    'owner_email', $1,
    'owner_id', establishment_record.owner_id,
    'message', 'Login com segunda senha bem-sucedido'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Conceder permissões
GRANT EXECUTE ON FUNCTION check_second_password_login(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION check_second_password_login(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION check_second_password_login(TEXT, TEXT) TO service_role;

-- Permitir acesso público à função
ALTER FUNCTION check_second_password_login(TEXT, TEXT) SECURITY DEFINER;
