-- ACESSO DIRETO DO DONO - SQL COMPLETO
DROP FUNCTION IF EXISTS create_admin_access(UUID);
DROP FUNCTION IF EXISTS get_owner_credentials(UUID);

CREATE OR REPLACE FUNCTION create_admin_access(establishment_id UUID)
RETURNS JSONB AS $$
DECLARE
  establishment_record RECORD;
  user_record RECORD;
  admin_user_id UUID;
  admin_email TEXT;
BEGIN
  SELECT e.id, e.name, e.code, e.owner_id, u.email
  INTO establishment_record
  FROM establishments e
  JOIN auth.users u ON e.owner_id = u.id
  WHERE e.id = establishment_id;

  IF establishment_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Estabelecimento não encontrado'
    );
  END IF;

  admin_user_id := gen_random_uuid();
  admin_email := 'admin_' || establishment_record.code || '_' || extract(epoch from now())::text || '@admin.com';

  INSERT INTO auth.users (
    id, email, encrypted_password, email_confirmed_at, created_at, updated_at,
    raw_user_meta_data, aud, role
  ) VALUES (
    admin_user_id,
    admin_email,
    crypt('admin123', gen_salt('bf')),
    NOW(), NOW(), NOW(),
    jsonb_build_object(
      'admin_access', true,
      'role', 'establishment',
      'establishment_id', establishment_id,
      'establishment_name', establishment_record.name,
      'establishment_code', establishment_record.code,
      'admin_impersonation', true,
      'full_name', establishment_record.name
    ),
    'authenticated', 'authenticated'
  );

  RETURN jsonb_build_object(
    'success', true,
    'admin_user_id', admin_user_id,
    'admin_email', admin_email,
    'admin_password', 'admin123',
    'establishment_id', establishment_record.id,
    'establishment_name', establishment_record.name,
    'establishment_code', establishment_record.code,
    'original_email', establishment_record.email,
    'message', 'Usuário admin criado com sucesso'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_admin_access(UUID) TO anon;
GRANT EXECUTE ON FUNCTION create_admin_access(UUID) TO authenticated;
