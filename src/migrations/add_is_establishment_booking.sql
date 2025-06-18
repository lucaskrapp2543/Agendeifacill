-- Adiciona a coluna is_establishment_booking à tabela appointments
ALTER TABLE appointments
ADD COLUMN is_establishment_booking BOOLEAN DEFAULT FALSE; 