-- REMOVER CONTA DE CLIENTE: john.ericles@hotmail.com
-- Script simples para remover conta de cliente (não estabelecimento)

-- 1. Verificar se a conta existe
SELECT 
  id,
  email,
  created_at,
  raw_user_meta_data->>'role' as tipo_conta
FROM auth.users 
WHERE email = 'john.ericles@hotmail.com';

-- 2. Verificar agendamentos do cliente (se houver)
SELECT 
  COUNT(*) as total_agendamentos
FROM appointments 
WHERE client_email = 'john.ericles@hotmail.com'
   OR client_whatsapp IN (
     SELECT raw_user_meta_data->>'whatsapp' 
     FROM auth.users 
     WHERE email = 'john.ericles@hotmail.com'
   );

-- 3. DELETAR a conta do cliente
DELETE FROM auth.users 
WHERE email = 'john.ericles@hotmail.com';

-- 4. Verificar se foi removido
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ CONTA REMOVIDA COM SUCESSO!'
    ELSE '❌ Conta ainda existe'
  END as status
FROM auth.users 
WHERE email = 'john.ericles@hotmail.com';

-- NOTA: Os agendamentos do cliente permanecem nos estabelecimentos
-- (isso é normal, pois o histórico pertence ao estabelecimento)

