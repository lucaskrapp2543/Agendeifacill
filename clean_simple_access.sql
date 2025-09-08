-- LIMPEZA TOTAL E SOLUÇÃO SIMPLES
DROP FUNCTION IF EXISTS ultimate_master_access(UUID);
DROP FUNCTION IF EXISTS master_direct_access(UUID);
DROP FUNCTION IF EXISTS bypass_support_access(UUID);
DROP FUNCTION IF EXISTS support_direct_access(UUID);
DROP FUNCTION IF EXISTS create_admin_access(UUID);
DROP FUNCTION IF EXISTS get_establishment_owner_info(UUID);
DROP FUNCTION IF EXISTS get_establishment_for_admin(UUID);
DROP FUNCTION IF EXISTS admin_access_establishment_safe(UUID);
DROP FUNCTION IF EXISTS admin_access_establishment(UUID);
DROP FUNCTION IF EXISTS set_admin_password_temp(TEXT);
DROP FUNCTION IF EXISTS restore_original_password(TEXT, TEXT);
DROP FUNCTION IF EXISTS create_admin_user(UUID);
DROP FUNCTION IF EXISTS remove_admin_user(UUID);

-- FUNÇÃO SIMPLES PARA ACESSO DIRETO
CREATE OR REPLACE FUNCTION get_establishment_data(establishment_id UUID)
RETURNS JSONB AS $$
DECLARE
  establishment_record RECORD;
BEGIN
  SELECT e.id, e.name, e.code, e.owner_id, u.email, u.id as user_id
  INTO establishment_record
  FROM establishments e
  JOIN auth.users u ON e.owner_id = u.id
  WHERE e.id = establishment_id;

  IF establishment_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Estabelecimento não encontrado');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'establishment_id', establishment_record.id,
    'establishment_name', establishment_record.name,
    'establishment_code', establishment_record.code,
    'owner_email', establishment_record.email,
    'owner_id', establishment_record.user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_establishment_data(UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_establishment_data(UUID) TO authenticated;
