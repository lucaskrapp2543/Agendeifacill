-- Criar função para adicionar colunas se não existirem
CREATE OR REPLACE FUNCTION add_column_if_not_exists(
  table_name text,
  column_name text,
  column_type text,
  default_value text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = $1
    AND column_name = $2
  ) THEN
    EXECUTE format('ALTER TABLE %I ADD COLUMN %I %s %s',
      table_name,
      column_name,
      column_type,
      CASE
        WHEN default_value IS NOT NULL THEN 'DEFAULT ' || default_value
        ELSE ''
      END
    );
  END IF;
END;
$$ LANGUAGE plpgsql; 