-- Migração: Adicionar coluna wifi_password para acomodar senha de Wi-Fi do estabelecimento
-- Data: 15/06/2025

ALTER TABLE establishments 
ADD COLUMN IF NOT EXISTS wifi_password TEXT;

-- Comentário para documentar a coluna
COMMENT ON COLUMN establishments.wifi_password IS 'Senha de Wi-Fi disponibilizada pelo estabelecimento para clientes.'; 