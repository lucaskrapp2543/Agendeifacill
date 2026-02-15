-- Campo de observação para despesas (até 150 caracteres no frontend)
-- Compatível com ambiente já em produção.

ALTER TABLE establishment_expenses
ADD COLUMN IF NOT EXISTS observation TEXT;

COMMENT ON COLUMN establishment_expenses.observation IS
'Observação opcional da despesa (limite de 150 caracteres aplicado no frontend).';
