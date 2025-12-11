-- Adicionar coluna custom_link na tabela subscriptions
-- Esta coluna permite que cada assinatura tenha um link personalizado
-- que será usado ao invés do WhatsApp quando o cliente clicar em "Assinar"

ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS custom_link TEXT;

-- Comentário explicativo
COMMENT ON COLUMN subscriptions.custom_link IS 'Link personalizado para redirecionamento ao clicar em Assinar. Se preenchido, substitui o comportamento padrão do WhatsApp.';

