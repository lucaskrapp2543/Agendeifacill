-- Executar migração para adicionar taxas por bandeira de cartão
-- Execute este SQL no Supabase SQL Editor

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

-- 2. Verificar se foi criada
SELECT 'Coluna card_brand_taxes criada com sucesso!' as status;
