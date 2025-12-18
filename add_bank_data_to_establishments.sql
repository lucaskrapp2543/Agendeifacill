-- Migração: Adicionar campos de dados bancários na tabela establishments
-- Este script adiciona os campos necessários para pagamento antecipado

-- Adicionar colunas se não existirem
ALTER TABLE establishments
ADD COLUMN IF NOT EXISTS bank_cpf_cnpj TEXT,
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS bank_agency TEXT,
ADD COLUMN IF NOT EXISTS bank_account TEXT;

-- Comentários para documentação
COMMENT ON COLUMN establishments.bank_cpf_cnpj IS 'CPF ou CNPJ do estabelecimento para recebimento';
COMMENT ON COLUMN establishments.bank_name IS 'Nome do banco';
COMMENT ON COLUMN establishments.bank_agency IS 'Agência bancária';
COMMENT ON COLUMN establishments.bank_account IS 'Número da conta bancária';

-- Verificar se as colunas foram criadas
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'establishments' 
AND column_name IN ('bank_cpf_cnpj', 'bank_name', 'bank_agency', 'bank_account')
ORDER BY column_name;




