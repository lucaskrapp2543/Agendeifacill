-- REMOVER CONTA: john.ericles@hotmail.com
-- Este script remove completamente a conta e todos os dados relacionados
-- ATENÇÃO: Esta operação é IRREVERSÍVEL!

-- ========================================
-- PASSO 1: VERIFICAR SE A CONTA EXISTE
-- ========================================

SELECT 
  id,
  email,
  created_at,
  email_confirmed_at
FROM auth.users 
WHERE email = 'john.ericles@hotmail.com';

-- ========================================
-- PASSO 2: BUSCAR ESTABELECIMENTO(S) RELACIONADO(S)
-- ========================================

SELECT 
  id,
  name,
  code,
  owner_id,
  created_at
FROM establishments 
WHERE owner_id IN (
  SELECT id FROM auth.users WHERE email = 'john.ericles@hotmail.com'
);

-- ========================================
-- PASSO 3: VERIFICAR QUANTIDADE DE DADOS
-- ========================================

SELECT 
  'appointments' as tabela,
  COUNT(*) as registros
FROM appointments a
JOIN establishments e ON a.establishment_id = e.id
WHERE e.owner_id IN (
  SELECT id FROM auth.users WHERE email = 'john.ericles@hotmail.com'
)

UNION ALL

SELECT 
  'appointment_products' as tabela,
  COUNT(*) as registros
FROM appointment_products ap
WHERE ap.appointment_id IN (
  SELECT a.id 
  FROM appointments a
  JOIN establishments e ON a.establishment_id = e.id
  WHERE e.owner_id IN (
    SELECT id FROM auth.users WHERE email = 'john.ericles@hotmail.com'
  )
)

UNION ALL

SELECT 
  'establishment_products' as tabela,
  COUNT(*) as registros
FROM establishment_products ep
JOIN establishments e ON ep.establishment_id = e.id
WHERE e.owner_id IN (
  SELECT id FROM auth.users WHERE email = 'john.ericles@hotmail.com'
)

UNION ALL

SELECT 
  'service_categories' as tabela,
  COUNT(*) as registros
FROM service_categories sc
WHERE sc.establishment_id IN (
  SELECT id FROM establishments 
  WHERE owner_id IN (
    SELECT id FROM auth.users WHERE email = 'john.ericles@hotmail.com'
  )
)

UNION ALL

SELECT 
  'premium_subscriptions' as tabela,
  COUNT(*) as registros
FROM premium_subscriptions ps
WHERE ps.establishment_id IN (
  SELECT id FROM establishments 
  WHERE owner_id IN (
    SELECT id FROM auth.users WHERE email = 'john.ericles@hotmail.com'
  )
);

-- ========================================
-- PASSO 4: REMOVER DADOS (em ordem devido às foreign keys)
-- ========================================

-- 4.1. Remover vendas de produtos em agendamentos
DELETE FROM appointment_products 
WHERE appointment_id IN (
  SELECT a.id 
  FROM appointments a
  JOIN establishments e ON a.establishment_id = e.id
  WHERE e.owner_id IN (
    SELECT id FROM auth.users WHERE email = 'john.ericles@hotmail.com'
  )
);

-- 4.2. Remover serviços das metas de profissionais
DELETE FROM professional_goal_services
WHERE goal_id IN (
  SELECT pg.id
  FROM professional_goals pg
  WHERE pg.establishment_id IN (
    SELECT id FROM establishments 
    WHERE owner_id IN (
      SELECT id FROM auth.users WHERE email = 'john.ericles@hotmail.com'
    )
  )
);

-- 4.3. Remover metas de profissionais
DELETE FROM professional_goals
WHERE establishment_id IN (
  SELECT id FROM establishments 
  WHERE owner_id IN (
    SELECT id FROM auth.users WHERE email = 'john.ericles@hotmail.com'
  )
);

-- 4.4. Remover horários de trabalho de profissionais
DELETE FROM professional_work_hours
WHERE establishment_id IN (
  SELECT id FROM establishments 
  WHERE owner_id IN (
    SELECT id FROM auth.users WHERE email = 'john.ericles@hotmail.com'
  )
);

-- 4.5. Remover ausências de profissionais
DELETE FROM professional_absences
WHERE establishment_id IN (
  SELECT id FROM establishments 
  WHERE owner_id IN (
    SELECT id FROM auth.users WHERE email = 'john.ericles@hotmail.com'
  )
);

-- 4.6. Remover horários bloqueados de profissionais
DELETE FROM professional_blocked_hours
WHERE establishment_id IN (
  SELECT id FROM establishments 
  WHERE owner_id IN (
    SELECT id FROM auth.users WHERE email = 'john.ericles@hotmail.com'
  )
);

-- 4.7. Remover pagamentos profissionais
DELETE FROM professional_payments
WHERE establishment_id IN (
  SELECT id FROM establishments 
  WHERE owner_id IN (
    SELECT id FROM auth.users WHERE email = 'john.ericles@hotmail.com'
  )
);

-- 4.8. Remover agendamentos
DELETE FROM appointments 
WHERE establishment_id IN (
  SELECT id FROM establishments 
  WHERE owner_id IN (
    SELECT id FROM auth.users WHERE email = 'john.ericles@hotmail.com'
  )
);

-- 4.9. Remover subcategorias de serviços
DELETE FROM service_subcategories 
WHERE category_id IN (
  SELECT sc.id 
  FROM service_categories sc
  WHERE sc.establishment_id IN (
    SELECT id FROM establishments 
    WHERE owner_id IN (
      SELECT id FROM auth.users WHERE email = 'john.ericles@hotmail.com'
    )
  )
);

-- 4.10. Remover categorias de serviços
DELETE FROM service_categories 
WHERE establishment_id IN (
  SELECT id FROM establishments 
  WHERE owner_id IN (
    SELECT id FROM auth.users WHERE email = 'john.ericles@hotmail.com'
  )
);

-- 4.11. Remover produtos do estabelecimento
DELETE FROM establishment_products 
WHERE establishment_id IN (
  SELECT id FROM establishments 
  WHERE owner_id IN (
    SELECT id FROM auth.users WHERE email = 'john.ericles@hotmail.com'
  )
);

-- 4.12. Remover atendimentos de assinantes
DELETE FROM subscriber_attendances 
WHERE establishment_id IN (
  SELECT id FROM establishments 
  WHERE owner_id IN (
    SELECT id FROM auth.users WHERE email = 'john.ericles@hotmail.com'
  )
);

-- 4.13. Remover assinaturas premium
DELETE FROM premium_subscriptions 
WHERE establishment_id IN (
  SELECT id FROM establishments 
  WHERE owner_id IN (
    SELECT id FROM auth.users WHERE email = 'john.ericles@hotmail.com'
  )
);

-- 4.14. Remover despesas
DELETE FROM expenses
WHERE establishment_id IN (
  SELECT id FROM establishments 
  WHERE owner_id IN (
    SELECT id FROM auth.users WHERE email = 'john.ericles@hotmail.com'
  )
);

-- 4.15. Remover valores iniciais mensais
DELETE FROM initial_values
WHERE establishment_id IN (
  SELECT id FROM establishments 
  WHERE owner_id IN (
    SELECT id FROM auth.users WHERE email = 'john.ericles@hotmail.com'
  )
);

-- 4.16. Remover notificações do estabelecimento
DELETE FROM establishment_notifications
WHERE establishment_id IN (
  SELECT id FROM establishments 
  WHERE owner_id IN (
    SELECT id FROM auth.users WHERE email = 'john.ericles@hotmail.com'
  )
);

-- 4.17. Remover formulários de cadastro
DELETE FROM registration_forms
WHERE establishment_id IN (
  SELECT id FROM establishments 
  WHERE owner_id IN (
    SELECT id FROM auth.users WHERE email = 'john.ericles@hotmail.com'
  )
);

-- 4.18. Remover aniversários de clientes
DELETE FROM client_birthdays
WHERE establishment_id IN (
  SELECT id FROM establishments 
  WHERE owner_id IN (
    SELECT id FROM auth.users WHERE email = 'john.ericles@hotmail.com'
  )
);

-- 4.19. Remover logs de auditoria (se existirem)
DELETE FROM audit_logs
WHERE establishment_id IN (
  SELECT id FROM establishments 
  WHERE owner_id IN (
    SELECT id FROM auth.users WHERE email = 'john.ericles@hotmail.com'
  )
);

-- 4.20. Remover estabelecimento
DELETE FROM establishments 
WHERE owner_id IN (
  SELECT id FROM auth.users WHERE email = 'john.ericles@hotmail.com'
);

-- 4.21. Remover usuário do auth.users
DELETE FROM auth.users 
WHERE email = 'john.ericles@hotmail.com';

-- ========================================
-- PASSO 5: VERIFICAR SE FOI REMOVIDO COM SUCESSO
-- ========================================

SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ CONTA REMOVIDA COM SUCESSO!'
    ELSE '❌ ERRO: Conta ainda existe'
  END as status,
  COUNT(*) as contas_restantes
FROM auth.users 
WHERE email = 'john.ericles@hotmail.com';

-- ========================================
-- PASSO 6: VERIFICAR SE NÃO HÁ DADOS ÓRFÃOS
-- ========================================

SELECT 
  'establishments' as tabela,
  COUNT(*) as registros_orfaos
FROM establishments 
WHERE owner_id IN (
  SELECT id FROM auth.users WHERE email = 'john.ericles@hotmail.com'
)

UNION ALL

SELECT 
  'appointments' as tabela,
  COUNT(*) as registros_orfaos
FROM appointments a
WHERE a.establishment_id IN (
  SELECT id FROM establishments 
  WHERE owner_id IN (
    SELECT id FROM auth.users WHERE email = 'john.ericles@hotmail.com'
  )
);

-- ========================================
-- INSTRUÇÕES DE USO
-- ========================================
-- 1. Execute este SQL no Supabase SQL Editor
-- 2. Primeiro execute os passos 1-3 para verificar os dados
-- 3. Se estiver certo, execute o passo 4 para deletar
-- 4. Execute os passos 5-6 para confirmar a remoção
-- 
-- ATENÇÃO: Esta operação é IRREVERSÍVEL!
-- Todos os dados da conta serão perdidos permanentemente.

