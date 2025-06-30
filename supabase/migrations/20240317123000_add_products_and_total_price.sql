-- Desativa temporariamente a trigger de validação
ALTER TABLE appointments DISABLE TRIGGER check_appointment_conflict_trigger;

-- Adiciona coluna para produtos adicionais
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS additional_products JSONB DEFAULT '[]'::jsonb;

-- Adiciona coluna para valor total (incluindo produtos adicionais)
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS total_price DECIMAL DEFAULT 0;

-- Atualiza o valor total para os agendamentos existentes
UPDATE appointments
SET total_price = price
WHERE total_price = 0;

-- Reativa a trigger de validação
ALTER TABLE appointments ENABLE TRIGGER check_appointment_conflict_trigger; 