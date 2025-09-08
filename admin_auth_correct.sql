-- Sistema de Senha Administrativa - Versão CORRETA
-- Execute este SQL no Supabase Dashboard

-- 1. Remover funções existentes
DROP FUNCTION IF EXISTS set_admin_password(TEXT);
DROP FUNCTION IF EXISTS restore_original_password(TEXT, TEXT);
DROP FUNCTION IF EXISTS admin_authenticate(TEXT, TEXT);
DROP FUNCTION IF EXISTS check_admin_access(TEXT, TEXT);

-- 2. Criar função que APENAS verifica acesso (NÃO altera senhas)
CREATE OR REPLACE FUNCTION check_admin_access(user_email TEXT, admin_password TEXT)
RETURNS JSONB AS $$
DECLARE
  user_record RECORD;
  establishment_record RECORD;
BEGIN
  -- Verificar senha administrativa
  IF admin_password != 'AgendeiFacil2024!@#' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Senha administrativa incorreta'
    );
  END IF;

  -- Buscar o usuário
  SELECT id, email, created_at
  INTO user_record
  FROM auth.users
  WHERE email = user_email;

  IF user_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Usuário não encontrado'
    );
  END IF;

  -- Buscar o estabelecimento
  SELECT id, name, code, owner_id
  INTO establishment_record
  FROM establishments
  WHERE owner_id = user_record.id;

  IF establishment_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Estabelecimento não encontrado para este usuário'
    );
  END IF;

  -- Retornar sucesso (SEM ALTERAR NADA)
  RETURN jsonb_build_object(
    'success', true,
    'user_id', user_record.id,
    'user_email', user_record.email,
    'establishment_id', establishment_record.id,
    'establishment_name', establishment_record.name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Conceder permissões
GRANT EXECUTE ON FUNCTION check_admin_access(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION check_admin_access(TEXT, TEXT) TO authenticated;

-- 4. Comentário
COMMENT ON FUNCTION check_admin_access(TEXT, TEXT) IS 'Verifica acesso administrativo SEM alterar senhas originais';
