-- Adiciona campo de controle de onboarding aos estabelecimentos
-- Valores possíveis:
-- 0 = Onboarding não iniciado (conta antiga, tudo liberado)
-- 1 = Precisa configurar Página Agendamento
-- 2 = Precisa adicionar primeiro profissional
-- 3 = Precisa adicionar primeiro serviço
-- 4 = Onboarding completo (tudo liberado)

ALTER TABLE establishments 
ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0;

-- Define que contas antigas (criadas antes desta migração) já têm onboarding completo
UPDATE establishments 
SET onboarding_step = 4 
WHERE onboarding_step = 0;

-- Novas contas começarão com onboarding_step = 1 (a ser definido no código)

