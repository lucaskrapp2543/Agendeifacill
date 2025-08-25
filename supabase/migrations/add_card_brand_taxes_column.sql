-- Adicionar coluna card_brand_taxes na tabela establishments
-- Este SQL adiciona a coluna para armazenar as taxas por bandeira de cartão

-- 1. Adicionar a coluna card_brand_taxes
ALTER TABLE establishments
ADD COLUMN IF NOT EXISTS card_brand_taxes JSONB DEFAULT '{
  "visa": 3.5,
  "mastercard": 3.5,
  "elo": 3.0,
  "hipercard": 3.0,
  "american_express": 4.0,
  "discover": 3.5,
  "jcb": 3.5,
  "outros": 3.5
}'::jsonb;

-- 2. Adicionar comentário para documentar a coluna
COMMENT ON COLUMN establishments.card_brand_taxes IS 'Taxas por bandeira de cartão em formato JSON';

-- 3. Verificar se a coluna foi criada
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'establishments'
AND column_name = 'card_brand_taxes';

-- 4. Mostrar estrutura atual da tabela
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'establishments'
ORDER BY ordinal_position;
