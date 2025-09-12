-- SQL para alterar senha do estabelecimento
-- Email: azgza987@gmail.com
-- Nova senha: Joao0306@

-- Atualizar a senha do estabelecimento
UPDATE establishments 
SET password = crypt('Joao0306@', gen_salt('bf'))
WHERE email = 'azgza987@gmail.com';

-- Verificar se a atualização foi bem-sucedida
SELECT 
    id,
    name,
    email,
    created_at,
    CASE 
        WHEN password IS NOT NULL THEN 'Senha atualizada com sucesso'
        ELSE 'Erro: Senha não foi atualizada'
    END as status
FROM establishments 
WHERE email = 'azgza987@gmail.com';

