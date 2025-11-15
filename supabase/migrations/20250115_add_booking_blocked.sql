-- Adiciona campo booking_blocked para bloquear booking de estabelecimentos
ALTER TABLE establishments 
ADD COLUMN IF NOT EXISTS booking_blocked BOOLEAN DEFAULT false;

-- Comentário explicativo
COMMENT ON COLUMN establishments.booking_blocked IS 'Indica se o booking (página pública de agendamento) está bloqueado';

