-- Adiciona campo admin_notes para observações privadas do admin sobre cada estabelecimento
ALTER TABLE establishments 
ADD COLUMN IF NOT EXISTS admin_notes TEXT DEFAULT NULL;

-- Comentário explicativo
COMMENT ON COLUMN establishments.admin_notes IS 'Observações privadas do admin sobre o estabelecimento (controle pessoal, valores pagos, etc)';


