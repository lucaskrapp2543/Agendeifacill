-- CORREÇÃO DO ACESSO ADMIN - FUNCIONA DE VERDADE
DROP FUNCTION IF EXISTS create_admin_access(UUID);

CREATE OR REPLACE FUNCTION create_admin_access(establishment_id UUID)
RETURNS JSONB AS $$
DECLARE
  establishment_record RECORD;
  user_record RECORD;
  admin_user_id UUID;
  admin_email TEXT;
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

  -- Gerar ID único e email único
  admin_user_id := gen_random_uuid();
  admin_email := 'admin_' || establishment_record.code || '_' || extract(epoch from now())::text || '@admin.com';

  -- Criar usuário admin temporário
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
    admin_email,
    crypt('admin123', gen_salt('bf')),
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
      'establishment_code', establishment_record.code,
      'admin_impersonation', true,
      'full_name', establishment_record.name
    ),
    'authenticated',
    'authenticated'
  );

  -- Retornar dados do usuário admin criado
  RETURN jsonb_build_object(
    'success', true,
    'admin_user_id', admin_user_id,
    'admin_email', admin_email,
    'admin_password', 'admin123',
    'establishment_id', establishment_record.id,
    'establishment_name', establishment_record.name,
    'establishment_code', establishment_record.code,
    'original_user_id', user_record.id,
    'original_email', user_record.email,
    'message', 'Usuário admin criado com sucesso'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Conceder permissões
GRANT EXECUTE ON FUNCTION create_admin_access(UUID) TO anon;
GRANT EXECUTE ON FUNCTION create_admin_access(UUID) TO authenticated;
