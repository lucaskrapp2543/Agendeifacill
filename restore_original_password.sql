-- Restaurar Senha Original do Usuário
-- Execute este SQL no Supabase Dashboard

-- 1. Função para restaurar senha original
CREATE OR REPLACE FUNCTION restore_user_password(user_email TEXT, new_password TEXT)
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
    'message', 'Senha restaurada com sucesso'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Conceder permissões
GRANT EXECUTE ON FUNCTION restore_user_password(TEXT, TEXT) TO authenticated;

-- 3. Comentário
COMMENT ON FUNCTION restore_user_password(TEXT, TEXT) IS 'Restaura senha original do usuário';

-- 4. Exemplo de uso (descomente e execute para restaurar a senha):
/*
SELECT restore_user_password('estabelecimento02@gmail.com', 'liikrapp0101');
*/
