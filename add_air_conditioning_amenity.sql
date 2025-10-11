-- Adicionar comodidade: Local Climatizado (Ar-Condicionado)
-- Este campo indica se o estabelecimento possui ar-condicionado

-- Adicionar coluna has_air_conditioning (boolean)
ALTER TABLE establishments
ADD COLUMN IF NOT EXISTS has_air_conditioning BOOLEAN DEFAULT false;

-- Comentário explicativo
COMMENT ON COLUMN establishments.has_air_conditioning IS 'Indica se o estabelecimento possui ar-condicionado/climatização';

-- Atualizar estabelecimentos existentes para false por padrão
UPDATE establishments
SET has_air_conditioning = false
WHERE has_air_conditioning IS NULL;

-- Verificar se funcionou
SELECT 
  id,
  name,
  has_wifi,
  has_parking,
  has_accessibility,
  has_air_conditioning
FROM establishments
LIMIT 5;

