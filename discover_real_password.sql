-- Função para descobrir a senha REAL do usuário
-- Execute este SQL no Supabase Dashboard

-- Remover função anterior
DROP FUNCTION IF EXISTS check_user_simple(TEXT);

-- Criar função para descobrir senha real
CREATE OR REPLACE FUNCTION discover_real_password(user_email TEXT)
RETURNS JSONB AS $$
DECLARE
  user_record RECORD;
  establishment_record RECORD;
  common_passwords TEXT[] := ARRAY[
    'liikrapp0101', '123456', 'password', '123456789', '12345678', '12345', '1234567',
    '1234567890', 'qwerty', 'abc123', '111111', '123123', 'admin',
    'letmein', 'welcome', 'monkey', '1234', 'dragon', 'master',
    'hello', 'freedom', 'whatever', 'qazwsx', 'trustno1', '654321',
    'jordan23', 'harley', 'password1', '123qwe', 'robert', 'matthew',
    'jordan', 'daniel', 'andrew', 'joshua', 'michael', 'charlie',
    'michelle', 'jessica', 'pepper', 'zxcvbn', 'superman', 'maggie',
    'computer', 'amanda', 'summer', 'hockey', 'ranger', 'banana',
    'passw0rd', 'tigger', 'sunshine', 'chocolate', 'anthony', 'diamond',
    'test', 'merlin', 'secret', 'dallas', 'jennifer', 'mickey', 'mustang',
    'shadow', 'buster', 'soccer', 'killer', 'george', 'sexy',
    'estabelecimento02', 'estabelecimento01', 'estabelecimento03',
    'admin123', 'senha123', '123456a', 'password123', 'admin1234'
  ];
  password_attempt TEXT;
  i INTEGER;
  encrypted_pass TEXT;
BEGIN
  -- Buscar o usuário
  SELECT id, email, encrypted_password, created_at
  INTO user_record
  FROM auth.users
  WHERE email = user_email;

  IF user_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Usuário não encontrado'
    );
  END IF;

  -- Buscar o estabelecimento (se existir)
  SELECT id, name, code
  INTO establishment_record
  FROM establishments
  WHERE owner_id = user_record.id;

  -- Obter a senha criptografada
  encrypted_pass := user_record.encrypted_password;

  -- Tentar senhas comuns (incluindo liikrapp0101)
  FOR i IN 1..array_length(common_passwords, 1) LOOP
    password_attempt := common_passwords[i];
    
    -- Verificar se a senha criptografada corresponde
    IF crypt(password_attempt, encrypted_pass) = encrypted_pass THEN
      
      RETURN jsonb_build_object(
        'success', true,
        'user_id', user_record.id,
        'user_email', user_record.email,
        'real_password', password_attempt,
        'created_at', user_record.created_at,
        'has_establishment', establishment_record IS NOT NULL,
        'establishment_id', COALESCE(establishment_record.id::text, ''),
        'establishment_name', COALESCE(establishment_record.name, ''),
        'establishment_code', COALESCE(establishment_record.code, ''),
        'password_found', true,
        'message', 'Senha descoberta com sucesso!'
      );
    END IF;
  END LOOP;

  -- Se não encontrou, retornar que não foi possível descobrir
  RETURN jsonb_build_object(
    'success', true,
    'user_id', user_record.id,
    'user_email', user_record.email,
    'real_password', 'Senha não encontrada (não é uma senha comum)',
    'created_at', user_record.created_at,
    'has_establishment', establishment_record IS NOT NULL,
    'establishment_id', COALESCE(establishment_record.id::text, ''),
    'establishment_name', COALESCE(establishment_record.name, ''),
    'establishment_code', COALESCE(establishment_record.code, ''),
    'password_found', false,
    'message', 'Usuário encontrado, mas senha não é comum'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Conceder permissões
GRANT EXECUTE ON FUNCTION discover_real_password(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION discover_real_password(TEXT) TO authenticated;

-- Comentário
COMMENT ON FUNCTION discover_real_password(TEXT) IS 'Descobre a senha real do usuário testando senhas comuns incluindo liikrapp0101';
