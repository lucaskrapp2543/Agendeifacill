-- Adicionar coluna client_whatsapp na tabela client_subscriptions
-- Para permitir reconhecimento automático de assinantes pelo WhatsApp

ALTER TABLE client_subscriptions 
ADD COLUMN IF NOT EXISTS client_whatsapp TEXT;

-- Adicionar comentário explicativo
COMMENT ON COLUMN client_subscriptions.client_whatsapp IS 'Número de WhatsApp do cliente para reconhecimento automático de assinantes';

-- Criar índice para melhor performance nas buscas por WhatsApp
CREATE INDEX IF NOT EXISTS idx_client_subscriptions_whatsapp 
ON client_subscriptions (client_whatsapp);

-- Criar índice composto para busca por estabelecimento + WhatsApp
CREATE INDEX IF NOT EXISTS idx_client_subscriptions_establishment_whatsapp 
ON client_subscriptions (establishment_id, client_whatsapp);

-- Verificar se a coluna foi criada
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'client_subscriptions' 
AND column_name = 'client_whatsapp';
