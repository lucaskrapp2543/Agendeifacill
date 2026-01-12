-- Adiciona % por colaborador (comissão) em produtos
-- Usado em "Meus Produtos" > "% por colaborador" para calcular repasse por venda de produto

ALTER TABLE establishment_products
ADD COLUMN IF NOT EXISTS commission_percentages JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN establishment_products.commission_percentages IS
'Mapa JSON { "Nome do profissional": percentual } para repasse por venda de produto.';


