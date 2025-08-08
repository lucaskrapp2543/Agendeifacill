-- Adicionar coluna is_subscriber na tabela appointments
-- Esta coluna indica se o agendamento é para um cliente assinante

ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS is_subscriber BOOLEAN DEFAULT FALSE;

-- Adicionar comentário explicativo
COMMENT ON COLUMN appointments.is_subscriber IS 'Indica se o agendamento é para um cliente assinante (gratuito)';

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_appointments_is_subscriber 
ON appointments (is_subscriber);

-- Verificar se a coluna foi criada
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'appointments' 
AND column_name = 'is_subscriber'; 