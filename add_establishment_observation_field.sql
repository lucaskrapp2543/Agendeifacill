-- Adicionar campo de observação do estabelecimento
-- Execute este script no SQL Editor do Supabase

-- 1. Adicionar campo de observação do estabelecimento
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS establishment_observation TEXT;

-- 2. Verificar se o campo foi criado
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'appointments' 
AND column_name = 'establishment_observation';

-- 3. Confirmar criação
SELECT 'Campo establishment_observation criado com sucesso!' as status;
