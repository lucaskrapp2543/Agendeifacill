-- Adiciona suporte a comodidades personalizadas no booking
-- Estrutura: [{ id, name, icon, enabled }]

ALTER TABLE establishments
ADD COLUMN IF NOT EXISTS custom_amenities JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN establishments.custom_amenities IS
'Lista de comodidades personalizadas do estabelecimento (id, nome, icone e status)';

-- Garantia para registros legados que possam estar nulos
UPDATE establishments
SET custom_amenities = '[]'::jsonb
WHERE custom_amenities IS NULL;

-- Consulta rápida de validação
SELECT id, name, custom_amenities
FROM establishments
LIMIT 10;
