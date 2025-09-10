-- Script para alterar a senha do usuário felipegrilo2008@hotmail.com
-- Nova senha: souza25

-- Primeiro, vamos verificar se o usuário existe
SELECT id, email, created_at 
FROM auth.users 
WHERE email = 'felipegrilo2008@hotmail.com';

-- Atualizar a senha do usuário
-- Nota: A senha será criptografada automaticamente pelo Supabase Auth
UPDATE auth.users 
SET 
  encrypted_password = crypt('souza25', gen_salt('bf')),
  updated_at = now()
WHERE email = 'felipegrilo2008@hotmail.com';

-- Verificar se a atualização foi bem-sucedida
SELECT id, email, created_at, updated_at 
FROM auth.users 
WHERE email = 'felipegrilo2008@hotmail.com';

-- Mensagem de confirmação
SELECT 'Senha atualizada com sucesso para felipegrilo2008@hotmail.com' as status;

