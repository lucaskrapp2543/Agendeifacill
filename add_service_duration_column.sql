-- Adicionar coluna de duração do serviço na tabela subscriptions
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS service_duration INTEGER DEFAULT 30;

-- Comentário para documentar a nova coluna
COMMENT ON COLUMN subscriptions.service_duration IS 'Duração do serviço em minutos (15, 30, 45, 60, etc.)';

-- Atualizar registros existentes para ter duração padrão de 30 minutos
UPDATE subscriptions 
SET service_duration = 30 
WHERE service_duration IS NULL;
