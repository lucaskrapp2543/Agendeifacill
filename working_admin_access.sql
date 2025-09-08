-- SOLUÇÃO QUE FUNCIONA - ACESSO DIRETO SEM CRIAR USUÁRIO
DROP FUNCTION IF EXISTS create_admin_access(UUID);

CREATE OR REPLACE FUNCTION get_establishment_owner_info(establishment_id UUID)
RETURNS JSONB AS $$
DECLARE
  establishment_record RECORD;
BEGIN
  SELECT e.id, e.name, e.code, e.owner_id, u.email, u.created_at
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
    'owner_id', establishment_record.owner_id,
    'owner_created_at', establishment_record.created_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_establishment_owner_info(UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_establishment_owner_info(UUID) TO authenticated;
