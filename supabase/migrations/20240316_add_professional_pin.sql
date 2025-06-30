-- Adiciona coluna pin_password no tipo Professional dentro da tabela establishments
ALTER TABLE establishments 
ADD COLUMN IF NOT EXISTS professionals_pins JSONB DEFAULT '[]'::jsonb;

-- Garante que cada profissional tem um pin de 4 dígitos
CREATE OR REPLACE FUNCTION validate_professional_pins()
RETURNS TRIGGER AS $$
BEGIN
  -- Verifica se professionals_pins é um array JSON
  IF NOT (NEW.professionals_pins @> '[]'::jsonb) THEN
    RAISE EXCEPTION 'professionals_pins deve ser um array JSON';
  END IF;

  -- Verifica se cada pin tem 4 dígitos
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(NEW.professionals_pins) AS pin
    WHERE NOT (pin->>'pin' ~ '^[0-9]{4}$')
  ) THEN
    RAISE EXCEPTION 'Cada pin deve ter exatamente 4 dígitos numéricos';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Cria o trigger para validar os pins
DROP TRIGGER IF EXISTS validate_professional_pins_trigger ON establishments;
CREATE TRIGGER validate_professional_pins_trigger
  BEFORE INSERT OR UPDATE ON establishments
  FOR EACH ROW
  EXECUTE FUNCTION validate_professional_pins();

-- Atualiza os estabelecimentos existentes com pins padrão '0000' para profissionais existentes
UPDATE establishments
SET professionals_pins = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'professional_id', p->>'id',
      'pin', '0000'
    )
  )
  FROM jsonb_array_elements(professionals) p
)
WHERE professionals IS NOT NULL AND professionals != '[]'::jsonb; 