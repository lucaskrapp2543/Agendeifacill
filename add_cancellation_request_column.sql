-- ADICIONAR COLUNA: require_cancellation_request
-- Esta coluna controla se o estabelecimento exige solicitação de cancelamento via WhatsApp

-- Adicionar a coluna na tabela establishments
ALTER TABLE establishments 
ADD COLUMN require_cancellation_request BOOLEAN DEFAULT FALSE;

-- Comentário explicativo da coluna
COMMENT ON COLUMN establishments.require_cancellation_request IS 'Exige solicitação de cancelamento via WhatsApp ao invés de cancelamento direto';

-- Verificar se a coluna foi adicionada corretamente
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'establishments' 
AND column_name = 'require_cancellation_request';















