-- Adiciona campo admin_profit_value para controle de lucro manual por estabelecimento (admin)
ALTER TABLE establishments
ADD COLUMN IF NOT EXISTS admin_profit_value NUMERIC DEFAULT 0;

COMMENT ON COLUMN establishments.admin_profit_value IS 'Valor de lucro manual (admin) para somar no saldo geral do painel';

