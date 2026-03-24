-- META GLOBAL DE PROFISSIONAIS (COMPATÍVEL / NÃO QUEBRA FLUXO ANTIGO)
-- Pode rodar com segurança múltiplas vezes.

ALTER TABLE public.professional_goals
ADD COLUMN IF NOT EXISTS service_targets jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.professional_goals
ADD COLUMN IF NOT EXISTS bonus_percentage numeric(5,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.professional_goals.service_targets IS
'Mapa por serviço da meta: {"service_id_ou_chave": quantidade_alvo}.';

COMMENT ON COLUMN public.professional_goals.bonus_percentage IS
'Percentual aplicado aos serviços da meta quando a meta global mensal for atingida.';
