-- Função CORRIGIDA para buscar dados do proprietário do estabelecimento
-- Execute este SQL no Supabase Dashboard

-- Remover função anterior
DROP FUNCTION IF EXISTS get_establishment_owner(TEXT);

-- Criar função corrigida com tipo UUID
CREATE OR REPLACE FUNCTION get_establishment_owner(establishment_id UUID)
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

  -- Retornar dados do estabelecimento e proprietário
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
GRANT EXECUTE ON FUNCTION get_establishment_owner(UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_establishment_owner(UUID) TO authenticated;

-- Comentário
COMMENT ON FUNCTION get_establishment_owner(UUID) IS 'Função corrigida para buscar dados do proprietário do estabelecimento (tipo UUID)';
