-- Adicionar coluna is_deleted na tabela establishments
ALTER TABLE establishments 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_establishments_is_deleted ON establishments(is_deleted);

-- Comentário na coluna
COMMENT ON COLUMN establishments.is_deleted IS 'Flag para marcar estabelecimentos como excluídos (soft delete)';

-- Verificar se a coluna foi criada
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'establishments' AND column_name = 'is_deleted'; 