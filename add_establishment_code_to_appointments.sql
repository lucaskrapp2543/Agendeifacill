-- Adicionar coluna establishment_code à tabela appointments
-- Esta coluna armazenará o código do estabelecimento para facilitar consultas

ALTER TABLE appointments 
ADD COLUMN establishment_code TEXT;

-- Criar índice para melhorar performance das consultas
CREATE INDEX idx_appointments_establishment_code ON appointments(establishment_code);

-- Comentário explicativo
COMMENT ON COLUMN appointments.establishment_code IS 'Código do estabelecimento para facilitar consultas e navegação';
