-- Alterar senha do usuário azgza987@gmail.com
-- Nova senha: Joao0306@

-- 1. Verificar se o usuário existe
SELECT 
    id,
    email,
    created_at,
    email_confirmed_at
FROM auth.users 
WHERE email = 'azgza987@gmail.com';

-- 2. Alterar a senha
UPDATE auth.users 
SET encrypted_password = crypt('Joao0306@', gen_salt('bf'))
WHERE email = 'azgza987@gmail.com';

-- 3. Verificar se a alteração foi bem-sucedida
SELECT 
    id,
    email,
    created_at,
    'Senha alterada para Joao0306@' as status
FROM auth.users 
WHERE email = 'azgza987@gmail.com';

-- 4. Verificar qual estabelecimento pertence a este usuário
SELECT 
    e.id,
    e.name,
    e.code,
    e.created_at
FROM establishments e
JOIN auth.users u ON e.owner_id = u.id
WHERE u.email = 'azgza987@gmail.com';