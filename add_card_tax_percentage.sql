-- Adicionar colunas para taxas de cartão de crédito e débito na tabela establishments
ALTER TABLE establishments 
ADD COLUMN IF NOT EXISTS credit_card_tax_percentage DECIMAL(4,2) DEFAULT 3.5,
ADD COLUMN IF NOT EXISTS debit_card_tax_percentage DECIMAL(4,2) DEFAULT 2.5;

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_establishments_credit_card_tax_percentage ON establishments(credit_card_tax_percentage);
CREATE INDEX IF NOT EXISTS idx_establishments_debit_card_tax_percentage ON establishments(debit_card_tax_percentage);

-- Comentários nas colunas
COMMENT ON COLUMN establishments.credit_card_tax_percentage IS 'Taxa do cartão de crédito em porcentagem (ex: 3.5 para 3.5%)';
COMMENT ON COLUMN establishments.debit_card_tax_percentage IS 'Taxa do cartão de débito em porcentagem (ex: 2.5 para 2.5%)';

-- Verificar se as colunas foram criadas
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'establishments' AND column_name IN ('credit_card_tax_percentage', 'debit_card_tax_percentage'); 