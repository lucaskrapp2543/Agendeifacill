-- Separa despesas por origem:
-- financial = lançadas no Financeiro (interno da barbearia)
-- sidebar   = lançadas na tela de Despesas (livre para equipe/barbeiros)

ALTER TABLE establishment_expenses
ADD COLUMN IF NOT EXISTS expense_context TEXT;

-- Backfill seguro dos registros antigos:
-- Se não tem profissional vinculado, assume financeiro; caso contrário, sidebar.
UPDATE establishment_expenses
SET expense_context = CASE
  WHEN COALESCE(TRIM(professional), '') = '' AND professional_id IS NULL THEN 'financial'
  ELSE 'sidebar'
END
WHERE expense_context IS NULL;

ALTER TABLE establishment_expenses
ALTER COLUMN expense_context SET DEFAULT 'sidebar';

CREATE INDEX IF NOT EXISTS idx_establishment_expenses_context
  ON establishment_expenses (establishment_id, expense_context, created_at DESC);

COMMENT ON COLUMN establishment_expenses.expense_context IS
'Origem da despesa: financial (interno) ou sidebar (equipe/barbeiros).';
