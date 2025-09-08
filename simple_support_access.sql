-- ACESSO SIMPLES DO SUPORTE - FUNCIONA DE VERDADE
DROP FUNCTION IF EXISTS support_direct_access(UUID);

CREATE OR REPLACE FUNCTION support_direct_access(establishment_id UUID)
RETURNS JSONB AS $$
DECLARE
  establishment_record RECORD;
  admin_user_id UUID;
  admin_email TEXT;
BEGIN
  SELECT e.id, e.name, e.code, e.owner_id, u.email
  INTO establishment_record
  FROM establishments e
  JOIN auth.users u ON e.owner_id = u.id
  WHERE e.id = establishment_id;

  IF establishment_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Estabelecimento não encontrado');
  END IF;

  admin_user_id := gen_random_uuid();
  admin_email := 'support_' || establishment_record.code || '_' || extract(epoch from now())::text || '@support.com';

  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data, aud, role)
  VALUES (admin_user_id, admin_email, crypt('support123', gen_salt('bf')), NOW(), NOW(), NOW(), 
          jsonb_build_object('support_access', true, 'role', 'establishment', 'establishment_id', establishment_id, 'establishment_name', establishment_record.name, 'establishment_code', establishment_record.code, 'support_impersonation', true, 'full_name', establishment_record.name, 'original_owner_email', establishment_record.email), 
          'authenticated', 'authenticated');

  RETURN jsonb_build_object('success', true, 'admin_user_id', admin_user_id, 'admin_email', admin_email, 'admin_password', 'support123', 'establishment_id', establishment_record.id, 'establishment_name', establishment_record.name, 'establishment_code', establishment_record.code, 'original_email', establishment_record.email, 'message', 'Acesso de suporte criado');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION support_direct_access(UUID) TO anon;
GRANT EXECUTE ON FUNCTION support_direct_access(UUID) TO authenticated;
