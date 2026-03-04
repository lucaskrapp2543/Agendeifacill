-- Antecedencia minima (em minutos) para clientes agendarem no booking publico
-- Compatibilidade:
-- - Mantem coluna antiga booking_min_advance_hours
-- - Nova coluna booking_min_advance_minutes tem prioridade no frontend

ALTER TABLE public.establishments
ADD COLUMN IF NOT EXISTS booking_min_advance_minutes integer NOT NULL DEFAULT 0;

-- Migra configuracao legada em horas para minutos apenas quando ainda estiver 0.
UPDATE public.establishments
SET booking_min_advance_minutes = GREATEST(0, COALESCE(booking_min_advance_hours, 0)) * 60
WHERE COALESCE(booking_min_advance_minutes, 0) = 0
  AND COALESCE(booking_min_advance_hours, 0) > 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'establishments_booking_min_advance_minutes_check'
  ) THEN
    ALTER TABLE public.establishments
      ADD CONSTRAINT establishments_booking_min_advance_minutes_check
      CHECK (booking_min_advance_minutes >= 0 AND booking_min_advance_minutes <= 1440);
  END IF;
END $$;
