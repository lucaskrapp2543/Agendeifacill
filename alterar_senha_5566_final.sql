-- Alterar senha do estabelecimento 5566
-- Nova senha: Joao0306@

-- 1. Primeiro, vamos ver o owner_id do estabelecimento 5566
SELECT 
    id,
    name,
    code,
    owner_id
FROM establishments 
WHERE code = '5566';

-- 2. Alterar senha na tabela auth.users usando o owner_id
-- NOTA: Esta operação requer permissões de administrador
UPDATE auth.users 
SET encrypted_password = crypt('Joao0306@', gen_salt('bf'))
WHERE id = (
    SELECT owner_id 
    FROM establishments 
    WHERE code = '5566'
);

-- 3. Verificar se foi alterado
SELECT 
    id,
    created_at,
    'Senha alterada para Joao0306@' as status
FROM auth.users 
WHERE id = (
    SELECT owner_id 
    FROM establishments 
    WHERE code = '5566'
);

-- 4. Se não funcionar, tente esta alternativa (pode ser que a senha esteja em outra tabela)
-- UPDATE user_credentials 
-- SET password = crypt('Joao0306@', gen_salt('bf'))
-- WHERE user_id = (SELECT owner_id FROM establishments WHERE code = '5566');

