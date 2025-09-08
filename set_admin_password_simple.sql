-- Definir Senha Administrativa Temporária
-- Execute este SQL no Supabase Dashboard

-- 1. Função simples para definir senha administrativa
CREATE OR REPLACE FUNCTION set_admin_password_temp(user_email TEXT)
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

  -- Definir a senha administrativa
  UPDATE auth.users 
  SET encrypted_password = crypt('AgendeiFacil2024!@#', gen_salt('bf'))
  WHERE id = user_record.id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Senha administrativa definida'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Conceder permissões
GRANT EXECUTE ON FUNCTION set_admin_password_temp(TEXT) TO authenticated;

-- 3. Comentário
COMMENT ON FUNCTION set_admin_password_temp(TEXT) IS 'Define senha administrativa temporariamente';

-- 4. Exemplo de uso (descomente para usar):
/*
SELECT set_admin_password_temp('estabelecimento02@gmail.com');
*/
