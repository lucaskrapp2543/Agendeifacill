-- Migração: Adicionar campo pagarme_recipient_id na tabela establishments
-- Este campo armazena o ID do recebedor criado na Pagar.me

ALTER TABLE establishments
ADD COLUMN IF NOT EXISTS pagarme_recipient_id TEXT;

COMMENT ON COLUMN establishments.pagarme_recipient_id IS 'ID do recebedor criado na Pagar.me para pagamentos antecipados';

-- Verificar se a coluna foi criada
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'establishments' 
AND column_name = 'pagarme_recipient_id';








