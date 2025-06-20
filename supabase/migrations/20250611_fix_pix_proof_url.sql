-- Adicionar coluna pix_proof_url se não existir
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS pix_proof_url TEXT;

-- Comentário para documentação
COMMENT ON COLUMN appointments.pix_proof_url IS 'URL do comprovante de pagamento via PIX';

-- Verificar se a coluna foi criada
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'appointments' 
AND column_name = 'pix_proof_url'; 