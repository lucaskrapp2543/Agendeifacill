-- Prazo mínimo (em minutos) antes do horário do atendimento em que o cliente ainda pode cancelar pelo app/booking.
-- 0 = sem restrição por antecedência (só bloqueia se o horário já passou).
-- DEFAULT 180 (3h) alinha com o comportamento legado do frontend (LIMITE_CANCELAMENTO_HORAS = 3).

ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS booking_min_cancel_minutes integer NOT NULL DEFAULT 180;

COMMENT ON COLUMN public.establishments.booking_min_cancel_minutes IS
  'Minutos de antecedência mínima para o cliente cancelar pelo booking/app. Ex.: 60 = não cancela faltando menos de 1h. 0 = desligado.';
