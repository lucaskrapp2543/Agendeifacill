-- Controle global para ocultar avaliações no booking público sem quebrar bases antigas.
-- Só adiciona a coluna se a tabela existir.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'establishments'
  ) THEN
    ALTER TABLE public.establishments
    ADD COLUMN IF NOT EXISTS hide_booking_reviews boolean NOT NULL DEFAULT false;
  END IF;
END $$;
