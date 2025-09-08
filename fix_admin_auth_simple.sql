-- Versão Simplificada da Autenticação Administrativa
-- Execute este SQL no Supabase Dashboard

-- 1. Remover funções existentes se houver
DROP FUNCTION IF EXISTS verify_admin_password(TEXT);
DROP FUNCTION IF EXISTS get_establishment_by_owner_email(TEXT);
DROP FUNCTION IF EXISTS admin_authenticate(TEXT, TEXT);

-- 2. Criar função simplificada para autenticação administrativa
CREATE OR REPLACE FUNCTION admin_authenticate(owner_email TEXT, admin_password TEXT)
RETURNS JSONB AS $$
DECLARE
  establishment_data RECORD;
  user_data RECORD;
BEGIN
  -- Verificar se a senha administrativa está correta
  IF admin_password != 'AgendeiFacil2024!@#' THEN
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

-- 3. Conceder permissões
GRANT EXECUTE ON FUNCTION admin_authenticate(TEXT, TEXT) TO authenticated;

-- 4. Teste da função (opcional - descomente para testar)
/*
SELECT admin_authenticate('estabelecimento02@gmail.com', 'AgendeiFacil2024!@#');
*/
