-- Prazo minimo (em horas) para clientes agendarem no booking publico
-- Compatibilidade: default 0 = sem bloqueio de antecedencia
ALTER TABLE public.establishments
ADD COLUMN IF NOT EXISTS booking_min_advance_hours integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'establishments_booking_min_advance_hours_check'
  ) THEN
    ALTER TABLE public.establishments
      ADD CONSTRAINT establishments_booking_min_advance_hours_check
      CHECK (booking_min_advance_hours >= 0 AND booking_min_advance_hours <= 24);
  END IF;
END $$;
