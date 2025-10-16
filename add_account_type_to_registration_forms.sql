-- Adicionar coluna para distinguir entre contas de teste e contas pagas
-- Migration: add_account_type_to_registration_forms

-- Adicionar coluna account_type
ALTER TABLE registration_forms 
ADD COLUMN IF NOT EXISTS account_type VARCHAR(20) DEFAULT 'paid' 
CHECK (account_type IN ('paid', 'test'));

-- Atualizar registros existentes para 'paid' (padrão)
UPDATE registration_forms 
SET account_type = 'paid' 
WHERE account_type IS NULL;

-- Adicionar índice para performance
CREATE INDEX IF NOT EXISTS idx_registration_forms_account_type 
ON registration_forms(account_type);

-- Comentários para documentação
COMMENT ON COLUMN registration_forms.account_type IS 'Tipo de conta: paid (cadastroag) ou test (testefree)';

