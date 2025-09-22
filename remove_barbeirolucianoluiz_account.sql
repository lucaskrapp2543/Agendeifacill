-- REMOVER CONTA: barbeirolucianoluiz@gmail.com
-- Este script remove completamente a conta e todos os dados relacionados

-- 1. Primeiro, vamos verificar se a conta existe
SELECT 
  id,
  email,
  created_at,
  email_confirmed_at
FROM auth.users 
WHERE email = 'barbeirolucianoluiz@gmail.com';

-- 2. Buscar o estabelecimento relacionado (se existir)
SELECT 
  id,
  name,
  owner_id,
  created_at
FROM establishments 
WHERE owner_id IN (
  SELECT id FROM auth.users WHERE email = 'barbeirolucianoluiz@gmail.com'
);

-- 3. Verificar dados relacionados antes de deletar
SELECT 
  'appointments' as tabela,
  COUNT(*) as registros
FROM appointments a
JOIN establishments e ON a.establishment_id = e.id
WHERE e.owner_id IN (
  SELECT id FROM auth.users WHERE email = 'barbeirolucianoluiz@gmail.com'
)

UNION ALL

SELECT 
  'establishment_products' as tabela,
  COUNT(*) as registros
FROM establishment_products ep
JOIN establishments e ON ep.establishment_id = e.id
WHERE e.owner_id IN (
  SELECT id FROM auth.users WHERE email = 'barbeirolucianoluiz@gmail.com'
)

UNION ALL

SELECT 
  'service_categories' as tabela,
  COUNT(*) as registros
FROM service_categories sc
WHERE sc.establishment_id IN (
  SELECT id FROM establishments 
  WHERE owner_id IN (
    SELECT id FROM auth.users WHERE email = 'barbeirolucianoluiz@gmail.com'
  )
);

-- 4. REMOVER DADOS EM ORDEM (devido às foreign keys)

-- 4.1. Remover produtos dos agendamentos
DELETE FROM appointment_products 
WHERE appointment_id IN (
  SELECT a.id 
  FROM appointments a
  JOIN establishments e ON a.establishment_id = e.id
  WHERE e.owner_id IN (
    SELECT id FROM auth.users WHERE email = 'barbeirolucianoluiz@gmail.com'
  )
);

-- 4.2. Remover agendamentos
DELETE FROM appointments 
WHERE establishment_id IN (
  SELECT id FROM establishments 
  WHERE owner_id IN (
    SELECT id FROM auth.users WHERE email = 'barbeirolucianoluiz@gmail.com'
  )
);

-- 4.3. Remover subcategorias de serviços
DELETE FROM service_subcategories 
WHERE category_id IN (
  SELECT sc.id 
  FROM service_categories sc
  WHERE sc.establishment_id IN (
    SELECT id FROM establishments 
    WHERE owner_id IN (
      SELECT id FROM auth.users WHERE email = 'barbeirolucianoluiz@gmail.com'
    )
  )
);

-- 4.4. Remover categorias de serviços
DELETE FROM service_categories 
WHERE establishment_id IN (
  SELECT id FROM establishments 
  WHERE owner_id IN (
    SELECT id FROM auth.users WHERE email = 'barbeirolucianoluiz@gmail.com'
  )
);

-- 4.5. Remover produtos do estabelecimento
DELETE FROM establishment_products 
WHERE establishment_id IN (
  SELECT id FROM establishments 
  WHERE owner_id IN (
    SELECT id FROM auth.users WHERE email = 'barbeirolucianoluiz@gmail.com'
  )
);

-- 4.6. Remover assinaturas (se existirem)
DELETE FROM subscriber_attendances 
WHERE establishment_id IN (
  SELECT id FROM establishments 
  WHERE owner_id IN (
    SELECT id FROM auth.users WHERE email = 'barbeirolucianoluiz@gmail.com'
  )
);

DELETE FROM premium_subscriptions 
WHERE establishment_id IN (
  SELECT id FROM establishments 
  WHERE owner_id IN (
    SELECT id FROM auth.users WHERE email = 'barbeirolucianoluiz@gmail.com'
  )
);

-- 4.7. Remover estabelecimento
DELETE FROM establishments 
WHERE owner_id IN (
  SELECT id FROM auth.users WHERE email = 'barbeirolucianoluiz@gmail.com'
);

-- 4.8. Remover usuário do auth.users
DELETE FROM auth.users 
WHERE email = 'barbeirolucianoluiz@gmail.com';

-- 5. Verificar se foi removido com sucesso
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ CONTA REMOVIDA COM SUCESSO!'
    ELSE '❌ ERRO: Conta ainda existe'
  END as status
FROM auth.users 
WHERE email = 'barbeirolucianoluiz@gmail.com';

-- 6. Verificar se não há dados órfãos
SELECT 
  'establishments' as tabela,
  COUNT(*) as registros_restantes
FROM establishments 
WHERE owner_id IN (
  SELECT id FROM auth.users WHERE email = 'barbeirolucianoluiz@gmail.com'
)

UNION ALL

SELECT 
  'appointments' as tabela,
  COUNT(*) as registros_restantes
FROM appointments a
JOIN establishments e ON a.establishment_id = e.id
WHERE e.owner_id IN (
  SELECT id FROM auth.users WHERE email = 'barbeirolucianoluiz@gmail.com'
);

-- COMENTÁRIO: Execute este SQL no Supabase SQL Editor
-- ATENÇÃO: Esta operação é IRREVERSÍVEL!
-- Todos os dados da conta serão perdidos permanentemente.
