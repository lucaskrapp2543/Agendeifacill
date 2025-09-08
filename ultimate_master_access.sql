-- ACESSO ULTIMATE DO MESTRE - FUNCIONA DE VERDADE
DROP FUNCTION IF EXISTS master_direct_access(UUID);

CREATE OR REPLACE FUNCTION ultimate_master_access(establishment_id UUID)
RETURNS JSONB AS $$
DECLARE
  establishment_record RECORD;
  user_record RECORD;
  master_user_id UUID;
  master_email TEXT;
BEGIN
  SELECT e.id, e.name, e.code, e.owner_id, u.email, u.id as user_id
  INTO establishment_record
  FROM establishments e
  JOIN auth.users u ON e.owner_id = u.id
  WHERE e.id = establishment_id;

  IF establishment_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Estabelecimento não encontrado');
  END IF;

  -- Criar usuário mestre temporário com configurações especiais
  master_user_id := gen_random_uuid();
  master_email := 'master_' || establishment_record.code || '_' || extract(epoch from now())::text || '@master.com';

  -- Inserir usuário com configurações especiais para funcionar
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data, aud, role, confirmation_token, recovery_token, email_change_token_new, email_change)
  VALUES (
    master_user_id, 
    master_email, 
    crypt('master123', gen_salt('bf')), 
    NOW(), 
    NOW(), 
    NOW(), 
    jsonb_build_object(
      'master_access', true, 
      'role', 'establishment', 
      'establishment_id', establishment_id, 
      'establishment_name', establishment_record.name, 
      'establishment_code', establishment_record.code, 
      'master_impersonation', true, 
      'full_name', establishment_record.name, 
      'original_owner_email', establishment_record.email, 
      'original_owner_id', establishment_record.user_id
    ), 
    'authenticated', 
    'authenticated',
    '', -- confirmation_token vazio
    '', -- recovery_token vazio  
    '', -- email_change_token_new vazio
    ''  -- email_change vazio
  );

  RETURN jsonb_build_object(
    'success', true,
    'master_user_id', master_user_id,
    'master_email', master_email,
    'master_password', 'master123',
    'establishment_id', establishment_record.id,
    'establishment_name', establishment_record.name,
    'establishment_code', establishment_record.code,
    'original_email', establishment_record.email,
    'original_user_id', establishment_record.user_id,
    'message', 'Usuário mestre criado com sucesso'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION ultimate_master_access(UUID) TO anon;
GRANT EXECUTE ON FUNCTION ultimate_master_access(UUID) TO authenticated;
