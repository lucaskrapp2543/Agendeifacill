-- Migração: Corrigir campos de PIX para permitir 'naotenhopix'
-- Data: 11/06/2025

-- Primeiro, remover a constraint existente
ALTER TABLE establishments 
DROP CONSTRAINT IF EXISTS establishments_pix_key_type_check;

-- Adicionar a nova constraint que inclui 'naotenhopix'
ALTER TABLE establishments 
ADD CONSTRAINT establishments_pix_key_type_check 
CHECK (pix_key_type IN ('telefone', 'email', 'cpf', 'cnpj', 'chave_aleatoria', 'naotenhopix'));

-- Atualizar o comentário para incluir o novo tipo
COMMENT ON COLUMN establishments.pix_key_type IS 'Tipo da chave PIX (telefone, email, cpf, cnpj, chave_aleatoria, naotenhopix)';

-- Verificar se as alterações foram aplicadas
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'establishments' 
AND column_name IN ('pix_key_type', 'pix_key')
ORDER BY column_name; 