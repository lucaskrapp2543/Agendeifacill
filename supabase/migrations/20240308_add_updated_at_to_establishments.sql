-- Adicionar coluna updated_at
ALTER TABLE establishments
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Criar função para atualizar o updated_at
CREATE OR REPLACE FUNCTION update_establishments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para atualizar o updated_at automaticamente
DROP TRIGGER IF EXISTS establishments_updated_at ON establishments;
CREATE TRIGGER establishments_updated_at
    BEFORE UPDATE ON establishments
    FOR EACH ROW
    EXECUTE FUNCTION update_establishments_updated_at(); 