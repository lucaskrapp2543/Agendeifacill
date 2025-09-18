-- Criar tabela de produtos do estabelecimento
CREATE TABLE IF NOT EXISTS establishment_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID REFERENCES establishments(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  sale_price DECIMAL(10,2) NOT NULL,
  cost_price DECIMAL(10,2) NOT NULL,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  sold_quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Criar tabela de vendas de produtos nos agendamentos
CREATE TABLE IF NOT EXISTS appointment_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
  product_id UUID REFERENCES establishment_products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- RLS para estabelecimentos
ALTER TABLE establishment_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_products ENABLE ROW LEVEL SECURITY;

-- Políticas para establishment_products
CREATE POLICY "Establishments can manage their products" ON establishment_products
  FOR ALL USING (establishment_id IN (
    SELECT id FROM establishments WHERE owner_id = auth.uid()
  ));

-- Políticas para appointment_products
CREATE POLICY "Establishments can manage appointment products" ON appointment_products
  FOR ALL USING (appointment_id IN (
    SELECT a.id FROM appointments a
    JOIN establishments e ON a.establishment_id = e.id
    WHERE e.owner_id = auth.uid()
  ));

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_establishment_products_establishment_id ON establishment_products(establishment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_products_appointment_id ON appointment_products(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_products_product_id ON appointment_products(product_id);

-- Comentários explicativos
COMMENT ON TABLE establishment_products IS 'Produtos vendidos pelo estabelecimento com controle de estoque e lucro';
COMMENT ON COLUMN establishment_products.name IS 'Nome do produto (ex: Coca-Cola)';
COMMENT ON COLUMN establishment_products.sale_price IS 'Valor de venda (ex: R$ 5,00)';
COMMENT ON COLUMN establishment_products.cost_price IS 'Valor de custo/gasto (ex: R$ 2,50)';
COMMENT ON COLUMN establishment_products.stock_quantity IS 'Quantidade disponível em estoque';
COMMENT ON COLUMN establishment_products.sold_quantity IS 'Quantidade já vendida';

COMMENT ON TABLE appointment_products IS 'Produtos vendidos em agendamentos específicos';
COMMENT ON COLUMN appointment_products.quantity IS 'Quantidade vendida neste agendamento';
COMMENT ON COLUMN appointment_products.unit_price IS 'Preço unitário no momento da venda';
