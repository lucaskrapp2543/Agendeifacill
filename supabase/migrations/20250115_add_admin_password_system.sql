-- Sistema de Senha Administrativa Universal
-- Data: 2025-01-15
-- Descrição: Permite acesso administrativo a qualquer estabelecimento usando senha universal

-- 1. Criar função para verificar senha administrativa
CREATE OR REPLACE FUNCTION verify_admin_password(input_password TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Senha administrativa universal
  RETURN input_password = 'AgendeiFacil2024!@#';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Criar função para buscar estabelecimento por email do proprietário
CREATE OR REPLACE FUNCTION get_establishment_by_owner_email(owner_email TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  code TEXT,
  owner_id UUID,
  business_hours JSONB,
  professionals JSONB,
  services_with_prices JSONB,
  profile_image_url TEXT,
  affiliate_link TEXT,
  custom_photo_1_url TEXT,
  custom_photo_2_url TEXT,
  custom_photo_3_url TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.name,
    e.description,
    e.code,
    e.owner_id,
    e.business_hours,
    e.professionals,
    e.services_with_prices,
    e.profile_image_url,
    e.affiliate_link,
    e.custom_photo_1_url,
    e.custom_photo_2_url,
    e.custom_photo_3_url,
    e.created_at,
    e.updated_at
  FROM establishments e
  JOIN auth.users u ON u.id = e.owner_id
  WHERE u.email = owner_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Criar função para autenticação administrativa
CREATE OR REPLACE FUNCTION admin_authenticate(owner_email TEXT, admin_password TEXT)
RETURNS JSONB AS $$
DECLARE
  establishment_data RECORD;
  user_data RECORD;
  result JSONB;
BEGIN
  -- Verificar se a senha administrativa está correta
  IF NOT verify_admin_password(admin_password) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Senha administrativa incorreta'
    );
  END IF;

  -- Buscar o usuário pelo email
  SELECT * INTO user_data
  FROM auth.users
  WHERE email = owner_email;

  -- Se o usuário não existe, retornar erro
  IF user_data IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Usuário não encontrado'
    );
  END IF;

  -- Buscar o estabelecimento do usuário
  SELECT * INTO establishment_data
  FROM establishments
  WHERE owner_id = user_data.id;

  -- Se não tem estabelecimento, retornar erro
  IF establishment_data IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Estabelecimento não encontrado para este usuário'
    );
  END IF;

  -- Retornar sucesso com dados do usuário e estabelecimento
  RETURN jsonb_build_object(
    'success', true,
    'user', jsonb_build_object(
      'id', user_data.id,
      'email', user_data.email,
      'user_metadata', user_data.user_metadata,
      'created_at', user_data.created_at
    ),
    'establishment', jsonb_build_object(
      'id', establishment_data.id,
      'name', establishment_data.name,
      'code', establishment_data.code,
      'owner_id', establishment_data.owner_id
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Conceder permissões necessárias
GRANT EXECUTE ON FUNCTION verify_admin_password(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_establishment_by_owner_email(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_authenticate(TEXT, TEXT) TO authenticated;

-- 5. Comentários para documentação
COMMENT ON FUNCTION verify_admin_password(TEXT) IS 'Verifica se a senha fornecida é a senha administrativa universal AgendeiFacil2024!@#';
COMMENT ON FUNCTION get_establishment_by_owner_email(TEXT) IS 'Busca estabelecimento pelo email do proprietário';
COMMENT ON FUNCTION admin_authenticate(TEXT, TEXT) IS 'Autentica acesso administrativo usando email do proprietário e senha administrativa universal';
