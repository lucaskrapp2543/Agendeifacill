-- Adicionar coluna is_blocked na tabela establishments
-- Esta coluna controla se um estabelecimento esta bloqueado por falta de pagamento

ALTER TABLE establishments 
ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE;

-- Comentario na coluna para documentacao
COMMENT ON COLUMN establishments.is_blocked IS 'Controla se o estabelecimento esta bloqueado por falta de pagamento. Se TRUE, o usuario sera redirecionado para a pagina de bloqueio.';

-- Criar indice para melhor performance nas consultas de bloqueio
CREATE INDEX IF NOT EXISTS idx_establishments_is_blocked ON establishments(is_blocked);

-- Atualizar RLS (Row Level Security) se necessario
-- Nota: Verifique se as politicas RLS existentes precisam ser atualizadas para incluir esta nova coluna
