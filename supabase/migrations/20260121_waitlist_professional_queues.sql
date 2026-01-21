-- Fila de Espera: habilitar filas por profissional (até 3 filas ativas por estabelecimento)
-- Compatível com o modo antigo (fila única usando fila_espera_profissional_id)

BEGIN;

ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS fila_espera_profissional_ids UUID[] NULL;

-- Backfill: se já existe profissional padrão e ainda não existe array, criar array com 1 item
UPDATE public.establishments
SET fila_espera_profissional_ids = ARRAY[fila_espera_profissional_id]
WHERE fila_espera_profissional_ids IS NULL
  AND fila_espera_profissional_id IS NOT NULL;

-- Enforce: no máximo 3 filas por estabelecimento
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'establishments_waitlist_professional_ids_max3_chk'
  ) THEN
    ALTER TABLE public.establishments
      ADD CONSTRAINT establishments_waitlist_professional_ids_max3_chk
      CHECK (
        fila_espera_profissional_ids IS NULL
        OR array_length(fila_espera_profissional_ids, 1) <= 3
      );
  END IF;
END$$;

COMMIT;

NOTIFY pgrst, 'reload schema';

