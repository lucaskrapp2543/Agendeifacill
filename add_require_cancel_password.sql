-- Adicionar coluna require_cancel_password na tabela establishments
-- Esta coluna controla se é necessário pedir senha ao cancelar agendamento

ALTER TABLE establishments
ADD COLUMN IF NOT EXISTS require_cancel_password BOOLEAN DEFAULT false;

-- Comentário explicativo
COMMENT ON COLUMN establishments.require_cancel_password IS 'Se true, exige senha ao cancelar agendamento no dashboard';

