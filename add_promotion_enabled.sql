-- Adicionar coluna promotion_enabled na tabela establishments
-- Esta coluna controla se a propaganda de indicação está ativada para o estabelecimento

ALTER TABLE establishments 
ADD COLUMN IF NOT EXISTS promotion_enabled BOOLEAN DEFAULT false;

-- Criar índice para melhor performance nas consultas
CREATE INDEX IF NOT EXISTS idx_establishments_promotion_enabled ON establishments(promotion_enabled);

-- Comentário para documentação
COMMENT ON COLUMN establishments.promotion_enabled IS 'Indica se a propaganda de indicação está ativada. Quando ativado, mostra popup de indicação na página "Meus Agendamentos"';

-- Atualizar estabelecimentos existentes para ter propaganda desativada por padrão
UPDATE establishments
SET promotion_enabled = false
WHERE promotion_enabled IS NULL;

-- Verificar se funcionou
SELECT 
  id,
  name,
  code,
  promotion_enabled,
  payment_alert_enabled
FROM establishments
ORDER BY created_at DESC
LIMIT 10;

