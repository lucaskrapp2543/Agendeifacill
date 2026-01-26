-- Ocultar categorias/serviços APENAS do Booking público
-- Não afeta o uso interno (dashboard / reservar cliente)

ALTER TABLE service_categories
ADD COLUMN IF NOT EXISTS hidden_from_booking BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN service_categories.hidden_from_booking IS
'Se TRUE, a categoria não aparece no Booking público (apenas). Não afeta agendamento interno.';

ALTER TABLE service_subcategories
ADD COLUMN IF NOT EXISTS hidden_from_booking BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN service_subcategories.hidden_from_booking IS
'Se TRUE, o serviço não aparece no Booking público (apenas). Não afeta agendamento interno.';

CREATE INDEX IF NOT EXISTS idx_service_categories_establishment_hidden
  ON service_categories (establishment_id, hidden_from_booking);

CREATE INDEX IF NOT EXISTS idx_service_subcategories_category_hidden
  ON service_subcategories (category_id, hidden_from_booking);

