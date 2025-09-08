-- VERIFICAR SEGUNDA SENHA SALVA
CREATE OR REPLACE FUNCTION get_establishment_second_password(establishment_id UUID)
RETURNS JSONB AS $$
DECLARE
  establishment_record RECORD;
BEGIN
  SELECT e.id, e.name, e.code, e.second_password
  INTO establishment_record
  FROM establishments e
  WHERE e.id = establishment_id;

  IF establishment_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Estabelecimento não encontrado');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'establishment_id', establishment_record.id,
    'establishment_name', establishment_record.name,
    'establishment_code', establishment_record.code,
    'second_password', establishment_record.second_password,
    'has_second_password', establishment_record.second_password IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_establishment_second_password(UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_establishment_second_password(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_establishment_second_password(UUID) TO service_role;
