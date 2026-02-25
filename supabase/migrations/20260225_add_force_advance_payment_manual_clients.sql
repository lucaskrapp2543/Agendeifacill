-- Cobrança obrigatória por cliente (por telefone) sem quebrar bases antigas.
-- Só adiciona a coluna se a tabela existir.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'manual_clients'
  ) THEN
    ALTER TABLE public.manual_clients
    ADD COLUMN IF NOT EXISTS force_advance_payment boolean NOT NULL DEFAULT false;
  END IF;
END $$;
