-- Migração: Adicionar campos para configuração de PIX
-- Data: 09/06/2025
-- Funcionalidade: Configurações de PIX para pagamento

-- Adicionar campos para configuração de PIX
ALTER TABLE establishments 
ADD COLUMN IF NOT EXISTS pix_key_type TEXT CHECK (pix_key_type IN ('telefone', 'email', 'cpf', 'cnpj', 'chave_aleatoria')),
ADD COLUMN IF NOT EXISTS pix_key TEXT;

-- Comentários para documentação
COMMENT ON COLUMN establishments.pix_key_type IS 'Tipo da chave PIX (telefone, email, cpf, cnpj, chave_aleatoria)';
COMMENT ON COLUMN establishments.pix_key IS 'Chave PIX do estabelecimento';

-- Adicionar campos para comprovante de PIX na tabela appointments
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS pix_proof_url TEXT,
ADD COLUMN IF NOT EXISTS pix_payment_status TEXT DEFAULT 'pendente' CHECK (pix_payment_status IN ('pendente', 'enviado', 'confirmado', 'rejeitado'));

-- Comentários para documentação
COMMENT ON COLUMN appointments.pix_proof_url IS 'URL do comprovante de pagamento via PIX';
COMMENT ON COLUMN appointments.pix_payment_status IS 'Status do pagamento PIX (pendente, enviado, confirmado, rejeitado)';

-- Verificar se as colunas foram criadas
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'establishments' 
AND column_name IN ('pix_key_type', 'pix_key')
ORDER BY column_name;

SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'appointments' 
AND column_name IN ('pix_proof_url', 'pix_payment_status')
ORDER BY column_name; 