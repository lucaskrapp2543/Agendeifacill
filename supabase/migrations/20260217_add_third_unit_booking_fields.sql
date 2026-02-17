-- Terceira unidade: código e rótulo para link no booking e no dashboard
-- Se preenchido, pode ser exibido botão "Terceira unidade" que leva ao booking da outra unidade.

ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS third_unit_booking_code TEXT,
  ADD COLUMN IF NOT EXISTS third_unit_label TEXT;

COMMENT ON COLUMN public.establishments.third_unit_booking_code IS 'Código da terceira unidade (ex.: código do outro estabelecimento no booking)';
COMMENT ON COLUMN public.establishments.third_unit_label IS 'Texto exibido no botão/link da 3ª unidade (ex.: Unidade 3 centro)';
