-- Script para testar o sistema de metas
-- Execute este script no Supabase SQL Editor para verificar se tudo está funcionando

-- 1. Verificar se a tabela existe
SELECT 'Tabela professional_goals existe:' as teste, 
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'professional_goals') 
            THEN 'SIM' 
            ELSE 'NÃO' 
       END as resultado;

-- 2. Verificar estrutura da tabela
SELECT 'Estrutura da tabela:' as teste;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'professional_goals' 
ORDER BY ordinal_position;

-- 3. Verificar se há dados na tabela
SELECT 'Quantidade de metas cadastradas:' as teste, 
       COUNT(*) as total 
FROM professional_goals;

-- 4. Listar todas as metas (se houver)
SELECT 'Metas existentes:' as teste;
SELECT 
  establishment_id,
  professional_id,
  year,
  month,
  goal_amount,
  created_at
FROM professional_goals 
ORDER BY created_at DESC;

-- 5. Verificar políticas de RLS
SELECT 'Políticas RLS ativas:' as teste;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'professional_goals';

-- 6. Verificar se RLS está habilitado
SELECT 'RLS habilitado:' as teste,
       CASE WHEN relrowsecurity THEN 'SIM' 
            ELSE 'NÃO' 
       END as resultado
FROM pg_class 
WHERE relname = 'professional_goals';

-- 7. Teste de inserção (substitua os valores pelos seus)
-- DESCOMENTE E AJUSTE OS VALORES ABAIXO PARA TESTAR:
/*
INSERT INTO professional_goals (establishment_id, professional_id, year, month, goal_amount)
VALUES (
  'SEU_ESTABLISHMENT_ID_AQUI',  -- Substitua pelo ID do seu estabelecimento
  '36fa9135-5f74-4694-b142-b50c8d2e52e5',  -- ID do Josevaldo
  2024,  -- Ano atual
  12,    -- Dezembro
  20     -- Meta de 20 serviços
) ON CONFLICT (establishment_id, professional_id, year, month) 
DO UPDATE SET goal_amount = EXCLUDED.goal_amount, updated_at = now();

SELECT 'Meta de teste inserida!' as resultado;
*/







