-- Função para acesso administrativo SEM alterar senha do usuário
-- Execute este SQL no Supabase Dashboard

-- Remover funções que alteram senhas
DROP FUNCTION IF EXISTS set_admin_password_temp(TEXT);
DROP FUNCTION IF EXISTS restore_original_password(TEXT, TEXT);

-- Função para acesso administrativo SEM alterar senhas
CREATE OR REPLACE FUNCTION admin_access_establishment_safe(establishment_id UUID)
RETURNS JSONB AS $$
DECLARE
  establishment_record RECORD;
  user_record RECORD;
BEGIN
  -- Buscar o estabelecimento
  SELECT id, name, code, owner_id
  INTO establishment_record
  FROM establishments
  WHERE id = establishment_id;

  IF establishment_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Estabelecimento não encontrado'
    );
  END IF;

  -- Buscar o usuário proprietário
  SELECT id, email, created_at
  INTO user_record
  FROM auth.users
  WHERE id = establishment_record.owner_id;

  IF user_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Proprietário não encontrado'
    );
  END IF;

  -- Retornar dados para acesso administrativo (SEM ALTERAR SENHA)
  RETURN jsonb_build_object(
    'success', true,
    'establishment_id', establishment_record.id,
    'establishment_name', establishment_record.name,
    'establishment_code', establishment_record.code,
    'owner_id', user_record.id,
    'owner_email', user_record.email,
    'owner_created_at', user_record.created_at,
    'admin_access', true,
    'message', 'Acesso administrativo autorizado (senha original preservada)'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Conceder permissões
GRANT EXECUTE ON FUNCTION admin_access_establishment_safe(UUID) TO anon;
GRANT EXECUTE ON FUNCTION admin_access_establishment_safe(UUID) TO authenticated;

-- Comentário
COMMENT ON FUNCTION admin_access_establishment_safe(UUID) IS 'Acesso administrativo SEM alterar senha do usuário';
