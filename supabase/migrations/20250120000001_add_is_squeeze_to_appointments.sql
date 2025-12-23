-- Adicionar coluna is_squeeze na tabela appointments
-- Esta coluna indica se o agendamento é um encaixe (tempo manual, não usa duração padrão do serviço)

ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS is_squeeze BOOLEAN DEFAULT FALSE;

-- Comentário explicativo
COMMENT ON COLUMN appointments.is_squeeze IS 'Indica se o agendamento é um encaixe. Encaixes têm horário de início e término definidos manualmente e não usam a duração padrão do serviço.';

-- Criar índice para melhorar performance em consultas de encaixes
CREATE INDEX IF NOT EXISTS idx_appointments_is_squeeze ON appointments(is_squeeze) WHERE is_squeeze = TRUE;
















