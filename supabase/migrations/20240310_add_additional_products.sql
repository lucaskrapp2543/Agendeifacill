-- Adiciona coluna para produtos adicionais
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS additional_products JSONB DEFAULT '[]'::jsonb;

-- Adiciona coluna para valor total (incluindo produtos adicionais)
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS total_price DECIMAL DEFAULT 0; 