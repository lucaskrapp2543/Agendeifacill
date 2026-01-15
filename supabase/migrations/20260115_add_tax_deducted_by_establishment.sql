-- Adicionar coluna para controlar se a taxa é descontada do estabelecimento ou do profissional
-- Se true: taxa é descontada do estabelecimento (profissional recebe % do valor bruto)
-- Se false: taxa é descontada do profissional (comportamento padrão)

ALTER TABLE establishments
ADD COLUMN IF NOT EXISTS tax_deducted_by_establishment BOOLEAN DEFAULT false;

-- Adicionar comentário para documentar a coluna
COMMENT ON COLUMN establishments.tax_deducted_by_establishment IS 'Se true, as taxas da maquininha são descontadas do estabelecimento (não do profissional). Se false, as taxas são descontadas do profissional.';

-- Verificar se a coluna foi criada
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'establishments' 
AND column_name = 'tax_deducted_by_establishment';
