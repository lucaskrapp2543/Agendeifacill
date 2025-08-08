-- Adicionar coluna client_name_override na tabela client_subscriptions
-- Esta coluna armazena o nome do cliente no momento da criação da assinatura

ALTER TABLE client_subscriptions 
ADD COLUMN IF NOT EXISTS client_name_override TEXT;

-- Adicionar comentário explicativo
COMMENT ON COLUMN client_subscriptions.client_name_override IS 'Nome do cliente no momento da criação da assinatura (para clientes manuais)';

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_client_subscriptions_name_override 
ON client_subscriptions (client_name_override);

-- Verificar se a coluna foi criada
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'client_subscriptions' 
AND column_name = 'client_name_override'; 