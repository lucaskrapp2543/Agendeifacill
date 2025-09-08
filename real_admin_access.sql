-- SOLUÇÃO DEFINITIVA: Acesso administrativo real
-- Execute este SQL no Supabase Dashboard

-- Remover todas as funções anteriores
DROP FUNCTION IF EXISTS admin_access_establishment_safe(UUID);
DROP FUNCTION IF EXISTS admin_access_establishment(UUID);
DROP FUNCTION IF EXISTS set_admin_password_temp(TEXT);
DROP FUNCTION IF EXISTS restore_original_password(TEXT, TEXT);

-- Função para criar usuário administrativo temporário
CREATE OR REPLACE FUNCTION create_admin_user(establishment_id UUID)
RETURNS JSONB AS $$
DECLARE
  establishment_record RECORD;
  user_record RECORD;
  admin_user_id UUID;
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

  -- Gerar ID único para usuário admin temporário
  admin_user_id := gen_random_uuid();

  -- Criar usuário administrativo temporário
  INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_user_meta_data,
    aud,
    role
  ) VALUES (
    admin_user_id,
    'admin_' || establishment_record.code || '@temp.com',
    crypt('AgendeiFacil2024!@#', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    jsonb_build_object(
      'admin_access', true,
      'role', 'establishment',
      'original_user_id', user_record.id,
      'original_email', user_record.email,
      'establishment_id', establishment_id,
      'establishment_name', establishment_record.name,
      'admin_impersonation', true
    ),
    'authenticated',
    'authenticated'
  );

  -- Retornar dados do usuário admin criado
  RETURN jsonb_build_object(
    'success', true,
    'admin_user_id', admin_user_id,
    'admin_email', 'admin_' || establishment_record.code || '@temp.com',
    'admin_password', 'AgendeiFacil2024!@#',
    'establishment_id', establishment_record.id,
    'establishment_name', establishment_record.name,
    'establishment_code', establishment_record.code,
    'original_user_id', user_record.id,
    'original_email', user_record.email,
    'message', 'Usuário administrativo criado com sucesso'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para remover usuário admin temporário
CREATE OR REPLACE FUNCTION remove_admin_user(admin_user_id UUID)
RETURNS JSONB AS $$
BEGIN
  -- Remover usuário admin temporário
  DELETE FROM auth.users WHERE id = admin_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Usuário administrativo removido'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Conceder permissões
GRANT EXECUTE ON FUNCTION create_admin_user(UUID) TO anon;
GRANT EXECUTE ON FUNCTION create_admin_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_admin_user(UUID) TO anon;
GRANT EXECUTE ON FUNCTION remove_admin_user(UUID) TO authenticated;

-- Comentários
COMMENT ON FUNCTION create_admin_user(UUID) IS 'Cria usuário administrativo temporário para acesso real';
COMMENT ON FUNCTION remove_admin_user(UUID) IS 'Remove usuário administrativo temporário';
