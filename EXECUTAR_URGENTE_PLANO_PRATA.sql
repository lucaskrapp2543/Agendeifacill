-- ⚠️ EXECUTAR NO SUPABASE SQL EDITOR ⚠️
-- Adiciona a flag do botão PRATA (Admin) para bloquear recursos no menu do estabelecimento

ALTER TABLE establishments
ADD COLUMN IF NOT EXISTS plan_prata_active BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN establishments.plan_prata_active IS
'Se true, o estabelecimento está com Plano Prata ativo (bloqueia assinantes e produtos). Ativado via Admin.';

-- Verificar se foi criada
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'establishments'
  AND column_name = 'plan_prata_active';

