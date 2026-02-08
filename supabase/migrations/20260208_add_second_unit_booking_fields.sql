-- Segunda unidade: código e rótulo para link no booking e no dashboard
-- Se preenchido, mostra botão "Segunda unidade" que leva ao booking da outra unidade.

ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS second_unit_booking_code TEXT,
  ADD COLUMN IF NOT EXISTS second_unit_label TEXT;

COMMENT ON COLUMN public.establishments.second_unit_booking_code IS 'Código da segunda unidade (ex.: código do outro estabelecimento no booking)';
COMMENT ON COLUMN public.establishments.second_unit_label IS 'Texto exibido no botão/link (ex.: Unidade 2 bairro Carandai)';
