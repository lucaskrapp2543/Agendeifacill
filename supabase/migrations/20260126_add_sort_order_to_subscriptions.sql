-- Adiciona ordenação manual para tipos de assinatura (subscriptions)
-- Objetivo: permitir reordenar no painel e refletir a ordem no Booking

ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS sort_order INTEGER;

-- Backfill: definir uma ordem estável por estabelecimento (criados primeiro = topo)
WITH ranked AS (
  SELECT
    id,
    establishment_id,
    (ROW_NUMBER() OVER (PARTITION BY establishment_id ORDER BY created_at ASC, name ASC) - 1)::INTEGER AS rn
  FROM subscriptions
)
UPDATE subscriptions s
SET sort_order = r.rn
FROM ranked r
WHERE s.id = r.id
  AND s.sort_order IS NULL;

-- Garantir que nenhum registro fique sem ordenação
UPDATE subscriptions
SET sort_order = 0
WHERE sort_order IS NULL;

-- Default + NOT NULL para manter consistência em novos registros
ALTER TABLE subscriptions
ALTER COLUMN sort_order SET DEFAULT 0;

ALTER TABLE subscriptions
ALTER COLUMN sort_order SET NOT NULL;

-- Índice para leitura rápida no Booking/Painel
CREATE INDEX IF NOT EXISTS idx_subscriptions_establishment_sort_order
  ON subscriptions (establishment_id, sort_order);

