-- Adicionar coluna pix_payment_status se não existir
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS pix_payment_status TEXT DEFAULT 'pendente' CHECK (pix_payment_status IN ('pendente', 'enviado', 'confirmado', 'rejeitado'));

-- Comentário para documentação
COMMENT ON COLUMN appointments.pix_payment_status IS 'Status do pagamento PIX (pendente, enviado, confirmado, rejeitado)';

-- Verificar se a coluna foi criada
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'appointments' 
AND column_name = 'pix_payment_status'; 