-- Migração para adicionar configuração de notificações WhatsApp
-- Adiciona campo para controlar se o estabelecimento quer receber notificações via WhatsApp

-- Adicionar coluna para ativar/desativar notificações WhatsApp
ALTER TABLE establishments 
ADD COLUMN IF NOT EXISTS enable_whatsapp_notifications BOOLEAN DEFAULT false;

-- Comentário explicativo
COMMENT ON COLUMN establishments.enable_whatsapp_notifications IS 'Controla se o estabelecimento quer receber notificações via WhatsApp após agendamentos';

-- Verificar se a coluna foi criada
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'establishments' 
AND column_name = 'enable_whatsapp_notifications';
