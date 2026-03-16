-- Foto opcional para produtos do estoque/booking
ALTER TABLE public.establishment_products
ADD COLUMN IF NOT EXISTS image_url text;

