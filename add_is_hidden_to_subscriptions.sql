-- Adicionar campo is_hidden na tabela subscriptions
-- Este campo permite ocultar assinaturas do Booking sem deletá-las

ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;

-- Comentário para documentação
COMMENT ON COLUMN subscriptions.is_hidden IS 'Se TRUE, a assinatura não aparece no Booking para novos clientes, mas assinantes existentes continuam com acesso';

-- Verificar se o campo foi criado
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'subscriptions'
  AND column_name = 'is_hidden';

