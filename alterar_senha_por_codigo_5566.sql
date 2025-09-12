-- Alterar senha do estabelecimento com código 5566
-- Nova senha: Joao0306@

-- 1. Primeiro, vamos encontrar o owner_id do estabelecimento 5566
SELECT 
    id,
    name,
    code,
    owner_id,
    created_at
FROM establishments 
WHERE code = '5566';

-- 2. Alterar a senha usando o owner_id (assumindo que a senha está na tabela auth.users)
-- NOTA: Esta operação pode não funcionar dependendo das permissões do Supabase
UPDATE auth.users 
SET encrypted_password = crypt('Joao0306@', gen_salt('bf'))
WHERE id = (
    SELECT owner_id 
    FROM establishments 
    WHERE code = '5566'
);

-- 3. Verificar se a alteração foi bem-sucedida
SELECT 
    id,
    email,
    created_at,
    'Senha alterada' as status
FROM auth.users 
WHERE id = (
    SELECT owner_id 
    FROM establishments 
    WHERE code = '5566'
);

-- 4. Alternativa: Se a senha estiver em uma tabela separada
-- (Descomente se necessário)
/*
UPDATE user_passwords 
SET password = crypt('Joao0306@', gen_salt('bf'))
WHERE user_id = (
    SELECT owner_id 
    FROM establishments 
    WHERE code = '5566'
);
*/

