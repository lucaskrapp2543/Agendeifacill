-- Adicionar coluna fixed_commission_value na tabela subscriptions
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS fixed_commission_value DECIMAL(10,2) DEFAULT 0;

-- Comentário para documentar a coluna
COMMENT ON COLUMN public.subscriptions.fixed_commission_value IS 'Valor fixo de comissão por serviço diário da assinatura. Se 0, o valor deve ser preenchido manualmente ao adicionar atendimentos.';
