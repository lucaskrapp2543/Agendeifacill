-- Adiciona configuração "Dividir valor total" na assinatura
-- Regra: aplica divisão APÓS comissão de venda, antes do repasse por atendimento.

ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS divide_total_enabled boolean DEFAULT false;

ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS divide_total_attendances integer;

