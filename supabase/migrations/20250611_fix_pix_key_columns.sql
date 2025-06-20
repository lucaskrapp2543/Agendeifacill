-- Adicionar campos para configuração de PIX se não existirem
ALTER TABLE establishments 
ADD COLUMN IF NOT EXISTS pix_key_type TEXT CHECK (pix_key_type IN ('telefone', 'email', 'cpf', 'cnpj', 'chave_aleatoria')),
ADD COLUMN IF NOT EXISTS pix_key TEXT;

-- Comentários para documentação
COMMENT ON COLUMN establishments.pix_key_type IS 'Tipo da chave PIX (telefone, email, cpf, cnpj, chave_aleatoria)';
COMMENT ON COLUMN establishments.pix_key IS 'Chave PIX do estabelecimento';

-- Verificar se as colunas foram criadas
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'establishments' 
AND column_name IN ('pix_key_type', 'pix_key')
ORDER BY column_name; 