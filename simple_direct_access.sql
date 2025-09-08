-- SOLUÇÃO SIMPLES - ACESSO DIRETO DO DONO
DROP FUNCTION IF EXISTS create_admin_access(UUID);

CREATE OR REPLACE FUNCTION get_owner_credentials(establishment_id UUID)
RETURNS JSONB AS $$
DECLARE
  establishment_record RECORD;
  user_record RECORD;
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

  RETURN jsonb_build_object(
    'success', true,
    'owner_email', establishment_record.email,
    'establishment_name', establishment_record.name,
    'establishment_code', establishment_record.code
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_owner_credentials(UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_owner_credentials(UUID) TO authenticated;
