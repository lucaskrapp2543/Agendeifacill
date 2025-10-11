-- Adicionar campo para armazenar o nome da rede Wi-Fi
-- Este campo permite que o estabelecimento personalize o nome exibido da rede Wi-Fi

-- Adicionar coluna wifi_network_name (texto)
ALTER TABLE establishments
ADD COLUMN IF NOT EXISTS wifi_network_name TEXT DEFAULT '';

-- Comentário explicativo
COMMENT ON COLUMN establishments.wifi_network_name IS 'Nome personalizado da rede Wi-Fi exibido para os clientes (ex: "Barbearia WiFi")';

-- Verificar se funcionou
SELECT 
  id,
  name,
  has_wifi,
  wifi_password,
  wifi_network_name
FROM establishments
LIMIT 5;

