-- Etiquetas visuais por serviço (nome + cor)
-- Mantém compatibilidade: colunas opcionais e sem impacto no fluxo atual.

ALTER TABLE service_subcategories
ADD COLUMN IF NOT EXISTS label_name TEXT;

ALTER TABLE service_subcategories
ADD COLUMN IF NOT EXISTS label_color VARCHAR(7);

COMMENT ON COLUMN service_subcategories.label_name IS
'Nome da etiqueta visual do serviço (ex.: Serviço Assinatura).';

COMMENT ON COLUMN service_subcategories.label_color IS
'Cor hexadecimal da etiqueta visual (ex.: #22C55E).';

CREATE INDEX IF NOT EXISTS idx_service_subcategories_label_name
  ON service_subcategories (label_name)
  WHERE label_name IS NOT NULL;
