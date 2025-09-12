-- BUSCAR EMAIL DO BOOKING 5566
-- Execute este SQL no Supabase SQL Editor

-- Consulta principal para encontrar o EMAIL
SELECT 
    u.email as EMAIL_DO_USUARIO,
    u.created_at as DATA_CRIACAO_CONTA,
    e.name as NOME_ESTABELECIMENTO,
    e.code as CODIGO_ESTABELECIMENTO
FROM auth.users u
JOIN establishments e ON u.id = e.owner_id
WHERE e.code = '5566';

-- Se a consulta acima não funcionar, execute esta:
-- SELECT email FROM auth.users WHERE id = (SELECT owner_id FROM establishments WHERE code = '5566');

