-- Atualizar tabela establishment_initial_values para suportar valores por mês
-- Adicionar coluna month_year para identificar o mês/ano específico
ALTER TABLE establishment_initial_values 
ADD COLUMN IF NOT EXISTS month_year VARCHAR(7);

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_establishment_initial_values_month_year 
ON establishment_initial_values(establishment_id, month_year);

-- Comentário explicativo
COMMENT ON COLUMN establishment_initial_values.month_year IS 'Formato: YYYY-MM (ex: 2025-01) para identificar o mês específico do valor bruto editado';

-- Exemplo de uso:
-- Para setembro/2025: month_year = '2025-09'
-- Para outubro/2025: month_year = '2025-10'
