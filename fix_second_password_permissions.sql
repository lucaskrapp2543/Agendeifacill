-- CORREÇÃO DAS PERMISSÕES DA SEGUNDA SENHA
DROP FUNCTION IF EXISTS check_second_password_login(TEXT, TEXT);

-- Função com permissões corretas
CREATE OR REPLACE FUNCTION check_second_password_login(email TEXT, password TEXT)
RETURNS JSONB AS $$
DECLARE
  establishment_record RECORD;
BEGIN
  -- Buscar estabelecimento pela segunda senha
  SELECT e.id, e.name, e.code, e.owner_id, e.second_password, u.email, u.id as user_id
  INTO establishment_record
  FROM establishments e
  JOIN auth.users u ON e.owner_id = u.id
  WHERE u.email = $1 AND e.second_password = $2;

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

-- Conceder permissões para todos os usuários
GRANT EXECUTE ON FUNCTION check_second_password_login(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION check_second_password_login(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION check_second_password_login(TEXT, TEXT) TO service_role;

-- Permitir acesso público à função
ALTER FUNCTION check_second_password_login(TEXT, TEXT) SECURITY DEFINER;
