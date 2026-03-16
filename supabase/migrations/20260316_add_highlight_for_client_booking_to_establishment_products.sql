-- Destacar produtos no fluxo de booking público
ALTER TABLE public.establishment_products
ADD COLUMN IF NOT EXISTS highlight_for_client_booking boolean NOT NULL DEFAULT false;

-- Índice opcional para leitura rápida dos produtos destacados por estabelecimento
CREATE INDEX IF NOT EXISTS idx_establishment_products_highlight_booking
ON public.establishment_products (establishment_id, highlight_for_client_booking);
