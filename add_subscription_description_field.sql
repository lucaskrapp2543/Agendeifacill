-- ADICIONAR CAMPO DE DESCRIÇÃO PARA ASSINATURAS
-- Execute este script no SQL Editor do Supabase

-- 1. Adicionar campo description na tabela subscriptions
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS description TEXT;

-- 2. Adicionar constraint para limitar descrição a 150 caracteres
ALTER TABLE subscriptions
ADD CONSTRAINT subscriptions_description_length_check 
CHECK (LENGTH(description) <= 150);

-- 3. Verificar se o campo foi adicionado corretamente
SELECT
  column_name,
  data_type,
  is_nullable,
  character_maximum_length
FROM information_schema.columns
WHERE table_name = 'subscriptions'
  AND column_name = 'description';

-- 4. Verificar constraint criada
SELECT
  constraint_name,
  check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'subscriptions_description_length_check';

-- 5. Testar inserção de descrição
SELECT
  'Campo de descrição adicionado com sucesso!' as status,
  'Agora você pode adicionar descrições de até 150 caracteres para cada assinatura' as resultado;
