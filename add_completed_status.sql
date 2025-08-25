-- Adicionar o status 'completed' aos agendamentos
-- Versão simplificada e robusta

-- 1. Verificar se o tipo enum existe e adicionar 'completed'
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_status') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'appointment_status')
            AND enumlabel = 'completed'
        ) THEN
            ALTER TYPE appointment_status ADD VALUE 'completed';
        END IF;
    END IF;
END $$;

-- 2. Remover constraint antiga se existir
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;

-- 3. Adicionar nova constraint
ALTER TABLE appointments ADD CONSTRAINT appointments_status_check 
CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed'));

-- 4. Definir 'pending' como padrão
ALTER TABLE appointments ALTER COLUMN status SET DEFAULT 'pending';

-- 5. Atualizar agendamentos sem status
UPDATE appointments SET status = 'pending' WHERE status IS NULL;

-- 6. Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

-- 7. Verificar resultado
SELECT 
    'Migration completed successfully' as status,
    COUNT(*) as total_appointments,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_appointments,
    COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_appointments,
    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_appointments,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_appointments
FROM appointments;
