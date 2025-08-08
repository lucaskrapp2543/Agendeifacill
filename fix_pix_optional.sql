-- Script para tornar PIX totalmente opcional
-- Execute este script no SQL Editor do Supabase

-- Remover a constraint existente que força valores específicos
ALTER TABLE establishments 
DROP CONSTRAINT IF EXISTS establishments_pix_key_type_check;

-- Adicionar nova constraint que permite valores vazios
ALTER TABLE establishments 
ADD CONSTRAINT establishments_pix_key_type_check 
CHECK (
  pix_key_type IS NULL 
  OR pix_key_type = '' 
  OR pix_key_type IN ('telefone', 'email', 'cpf', 'cnpj', 'chave_aleatoria', 'naotenhopix')
);

-- Permitir que pix_key seja NULL também
ALTER TABLE establishments 
ALTER COLUMN pix_key DROP NOT NULL;

-- Permitir que pix_key_type seja NULL também
ALTER TABLE establishments 
ALTER COLUMN pix_key_type DROP NOT NULL;

-- Atualizar comentários
COMMENT ON COLUMN establishments.pix_key_type IS 'Tipo da chave PIX (opcional: telefone, email, cpf, cnpj, chave_aleatoria, naotenhopix)';
COMMENT ON COLUMN establishments.pix_key IS 'Chave PIX (opcional)';

-- Verificar se as alterações foram aplicadas
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'establishments' 
AND column_name IN ('pix_key_type', 'pix_key')
ORDER BY column_name; 