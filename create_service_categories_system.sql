-- Criar tabela de categorias de serviços
CREATE TABLE IF NOT EXISTS service_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID REFERENCES establishments(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Criar tabela de subcategorias (serviços específicos dentro de cada categoria)
CREATE TABLE IF NOT EXISTS service_subcategories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES service_categories(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  duration INTEGER NOT NULL DEFAULT 30, -- em minutos
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- RLS para service_categories
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;

-- Políticas para service_categories
CREATE POLICY "Establishments can manage their service categories" ON service_categories
  FOR ALL USING (establishment_id IN (
    SELECT id FROM establishments WHERE owner_id = auth.uid()
  ));

-- RLS para service_subcategories
ALTER TABLE service_subcategories ENABLE ROW LEVEL SECURITY;

-- Políticas para service_subcategories
CREATE POLICY "Establishments can manage their service subcategories" ON service_subcategories
  FOR ALL USING (category_id IN (
    SELECT sc.id FROM service_categories sc
    JOIN establishments e ON sc.establishment_id = e.id
    WHERE e.owner_id = auth.uid()
  ));

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_service_categories_establishment_id ON service_categories(establishment_id);
CREATE INDEX IF NOT EXISTS idx_service_categories_display_order ON service_categories(establishment_id, display_order);
CREATE INDEX IF NOT EXISTS idx_service_subcategories_category_id ON service_subcategories(category_id);
CREATE INDEX IF NOT EXISTS idx_service_subcategories_display_order ON service_subcategories(category_id, display_order);

-- Comentários explicativos
COMMENT ON TABLE service_categories IS 'Categorias principais de serviços (ex: BARBA, CABELO, etc.)';
COMMENT ON COLUMN service_categories.name IS 'Nome da categoria (ex: BARBA)';
COMMENT ON COLUMN service_categories.display_order IS 'Ordem de exibição no dropdown';

COMMENT ON TABLE service_subcategories IS 'Serviços específicos dentro de cada categoria';
COMMENT ON COLUMN service_subcategories.name IS 'Nome do serviço específico (ex: Barba lisa)';
COMMENT ON COLUMN service_subcategories.price IS 'Preço do serviço';
COMMENT ON COLUMN service_subcategories.duration IS 'Duração do serviço em minutos';
COMMENT ON COLUMN service_subcategories.display_order IS 'Ordem de exibição dentro da categoria';
