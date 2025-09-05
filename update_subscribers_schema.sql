-- Atualizar schema para suportar novos campos de assinantes
-- Adicionar campo de e-mail na tabela client_subscriptions
-- Adicionar campo de dias da semana na tabela subscriptions

-- Adicionar coluna de e-mail na tabela client_subscriptions
ALTER TABLE client_subscriptions 
ADD COLUMN IF NOT EXISTS client_email TEXT;

-- Adicionar coluna de dias da semana na tabela subscriptions (array de strings)
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS weekdays TEXT[];

-- Comentários para documentar as novas colunas
COMMENT ON COLUMN client_subscriptions.client_email IS 'E-mail do cliente assinante';
COMMENT ON COLUMN subscriptions.weekdays IS 'Array com os dias da semana permitidos para esta assinatura (monday, tuesday, wednesday, thursday, friday, saturday, sunday)';

-- Exemplo de uso:
-- weekdays: ['monday', 'tuesday', 'wednesday'] para segunda, terça e quarta
-- weekdays: ['saturday', 'sunday'] para sábado e domingo
