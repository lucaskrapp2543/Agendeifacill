-- Função para buscar a senha REAL do usuário (não criptografada)
-- Execute este SQL no Supabase Dashboard

CREATE OR REPLACE FUNCTION get_user_real_password(user_email TEXT)
RETURNS JSONB AS $$
DECLARE
  user_record RECORD;
  establishment_record RECORD;
BEGIN
  -- Buscar o usuário
  SELECT id, email, raw_user_meta_data, created_at
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

  -- Retornar informações do usuário
  RETURN jsonb_build_object(
    'success', true,
    'user_id', user_record.id,
    'user_email', user_record.email,
    'real_password', COALESCE(user_record.raw_user_meta_data->>'original_password', 'Senha não encontrada'),
    'created_at', user_record.created_at,
    'has_establishment', establishment_record IS NOT NULL,
    'establishment_id', establishment_record.id,
    'establishment_name', establishment_record.name,
    'establishment_code', establishment_record.code
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Conceder permissões
GRANT EXECUTE ON FUNCTION get_user_real_password(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_user_real_password(TEXT) TO authenticated;

-- Comentário
COMMENT ON FUNCTION get_user_real_password(TEXT) IS 'Busca a senha REAL do usuário (não criptografada)';
