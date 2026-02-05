-- Histórico de edições do "Resumo Bruto" (valor bruto editado manualmente no dashboard financeiro)
-- Cada vez que alguém clica em EDITAR e SALVAR, registramos valor anterior e novo para auditoria.

CREATE TABLE IF NOT EXISTS establishment_initial_values_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  month_year VARCHAR(7) NOT NULL,
  value_before NUMERIC(12,2) NULL,
  value_after NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE establishment_initial_values_history IS 'Histórico de alterações do valor bruto editado por mês (Resumo Bruto do dashboard financeiro)';
COMMENT ON COLUMN establishment_initial_values_history.month_year IS 'Formato YYYY-MM (ex: 2026-01)';
COMMENT ON COLUMN establishment_initial_values_history.value_before IS 'Valor antes da edição (NULL na primeira vez que define o valor)';
COMMENT ON COLUMN establishment_initial_values_history.value_after IS 'Valor após salvar a edição';

CREATE INDEX IF NOT EXISTS idx_establishment_initial_values_history_lookup
  ON establishment_initial_values_history(establishment_id, month_year, created_at DESC);

ALTER TABLE establishment_initial_values_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Establishments can view their own gross value history"
  ON establishment_initial_values_history FOR SELECT
  USING (establishment_id IN (
    SELECT id FROM establishments WHERE owner_id = auth.uid()
  ));

CREATE POLICY "Establishments can insert their own gross value history"
  ON establishment_initial_values_history FOR INSERT
  WITH CHECK (establishment_id IN (
    SELECT id FROM establishments WHERE owner_id = auth.uid()
  ));
