-- SISTEMA SIMPLES DE SEGUNDA SENHA
DROP FUNCTION IF EXISTS check_second_password_login(TEXT, TEXT);

-- Função simples que funciona
CREATE OR REPLACE FUNCTION check_second_password_login(email TEXT, password TEXT)
RETURNS JSONB AS $$
DECLARE
  establishment_record RECORD;
BEGIN
  -- Buscar estabelecimento pela segunda senha
  SELECT e.id, e.name, e.code, e.owner_id, e.second_password
  INTO establishment_record
  FROM establishments e
  WHERE e.second_password = $2;

  IF establishment_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Segunda senha inválida');
  END IF;

  -- Verificar se o email corresponde ao proprietário
  IF NOT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = establishment_record.owner_id 
    AND email = $1
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email não corresponde ao estabelecimento');
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
