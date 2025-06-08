-- Adicionar colunas que faltam na tabela appointments
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS price DECIMAL(10,2);

-- Atualizar os agendamentos existentes com os preços e durações dos serviços
UPDATE appointments a
SET 
  price = COALESCE((
    SELECT (s->>'price')::DECIMAL
    FROM establishments e,
    jsonb_array_elements(e.services_with_prices) s
    WHERE e.id = a.establishment_id
    AND s->>'name' = a.service
  ), 0),
  duration = COALESCE((
    SELECT (s->>'duration')::INTEGER
    FROM establishments e,
    jsonb_array_elements(e.services_with_prices) s
    WHERE e.id = a.establishment_id
    AND s->>'name' = a.service
  ), 30)
WHERE a.price IS NULL OR a.duration IS NULL; 