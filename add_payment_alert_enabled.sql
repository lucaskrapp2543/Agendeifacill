-- Adicionar coluna payment_alert_enabled na tabela establishments
-- Esta coluna controla se o alerta de pagamento em atraso está ativado para o estabelecimento

ALTER TABLE establishments 
ADD COLUMN IF NOT EXISTS payment_alert_enabled BOOLEAN DEFAULT false;

-- Criar índice para melhor performance nas consultas
CREATE INDEX IF NOT EXISTS idx_establishments_payment_alert_enabled ON establishments(payment_alert_enabled);

-- Comentário para documentação
COMMENT ON COLUMN establishments.payment_alert_enabled IS 'Indica se o alerta de pagamento em atraso está ativado para o estabelecimento';

