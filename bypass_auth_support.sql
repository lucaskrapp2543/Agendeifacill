-- BYPASS DE AUTENTICAÇÃO PARA SUPORTE - FUNCIONA DE VERDADE
DROP FUNCTION IF EXISTS support_direct_access(UUID);

CREATE OR REPLACE FUNCTION bypass_support_access(establishment_id UUID)
RETURNS JSONB AS $$
DECLARE
  establishment_record RECORD;
  user_record RECORD;
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
    'owner_id', establishment_record.user_id,
    'bypass_token', 'support_bypass_' || establishment_record.code || '_' || extract(epoch from now())::text,
    'message', 'Dados para bypass de suporte'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION bypass_support_access(UUID) TO anon;
GRANT EXECUTE ON FUNCTION bypass_support_access(UUID) TO authenticated;
