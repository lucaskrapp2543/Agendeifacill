-- Adiciona flag de Plano Prata (toggle via Admin)
-- Quando true: bloqueia "Meus Assinantes" e "Meus Produtos" no menu do estabelecimento

ALTER TABLE establishments
ADD COLUMN IF NOT EXISTS plan_prata_active BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN establishments.plan_prata_active IS
'Se true, o estabelecimento está com Plano Prata ativo (bloqueia assinantes e produtos). Ativado via Admin.';

