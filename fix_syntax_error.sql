-- SOLUÇÃO SIMPLES: Acesso administrativo que FUNCIONA (CORRIGIDO)
-- Execute este SQL no Supabase Dashboard

-- Remover todas as funções anteriores
DROP FUNCTION IF EXISTS admin_access_establishment_safe(UUID);
DROP FUNCTION IF EXISTS admin_access_establishment(UUID);
DROP FUNCTION IF EXISTS set_admin_password_temp(TEXT);
DROP FUNCTION IF EXISTS restore_original_password(TEXT, TEXT);
DROP FUNCTION IF EXISTS create_admin_user(UUID);
DROP FUNCTION IF EXISTS remove_admin_user(UUID);

-- Função simples para obter dados do estabelecimento
CREATE OR REPLACE FUNCTION get_establishment_for_admin(establishment_id UUID)
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

  -- Retornar dados
  RETURN jsonb_build_object(
    'success', true,
    'establishment_id', establishment_record.id,
    'establishment_name', establishment_record.name,
    'establishment_code', establishment_record.code,
    'owner_id', user_record.id,
    'owner_email', user_record.email,
    'owner_created_at', user_record.created_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Conceder permissões
GRANT EXECUTE ON FUNCTION get_establishment_for_admin(UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_establishment_for_admin(UUID) TO authenticated;
