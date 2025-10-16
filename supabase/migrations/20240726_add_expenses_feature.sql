-- Sistema de Despesas para Estabelecimentos
-- Permite cadastrar despesas e calcular lucro líquido

-- Tabela para armazenar despesas dos estabelecimentos
CREATE TABLE IF NOT EXISTS establishment_expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    establishment_id UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    professional TEXT,
    expense_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comentários explicativos
COMMENT ON TABLE establishment_expenses IS 'Despesas cadastradas pelos estabelecimentos';
COMMENT ON COLUMN establishment_expenses.name IS 'Nome/descrição da despesa';
COMMENT ON COLUMN establishment_expenses.amount IS 'Valor da despesa em reais';
COMMENT ON COLUMN establishment_expenses.professional IS 'Nome do profissional que registrou a despesa';
COMMENT ON COLUMN establishment_expenses.expense_date IS 'Data específica da despesa (para filtro por mês)';

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_establishment_expenses_establishment_id 
ON establishment_expenses (establishment_id);

CREATE INDEX IF NOT EXISTS idx_establishment_expenses_created_at 
ON establishment_expenses (created_at);

-- Políticas RLS (Row Level Security)
ALTER TABLE establishment_expenses ENABLE ROW LEVEL SECURITY;

-- Estabelecimentos podem ver apenas suas próprias despesas
CREATE POLICY "Establishments can view their own expenses"
ON establishment_expenses FOR SELECT
USING (establishment_id IN (
    SELECT id FROM establishments WHERE owner_id = auth.uid()
));

-- Estabelecimentos podem inserir suas próprias despesas
CREATE POLICY "Establishments can insert their own expenses"
ON establishment_expenses FOR INSERT
WITH CHECK (establishment_id IN (
    SELECT id FROM establishments WHERE owner_id = auth.uid()
));

-- Estabelecimentos podem atualizar suas próprias despesas
CREATE POLICY "Establishments can update their own expenses"
ON establishment_expenses FOR UPDATE
USING (establishment_id IN (
    SELECT id FROM establishments WHERE owner_id = auth.uid()
));

-- Estabelecimentos podem deletar suas próprias despesas
CREATE POLICY "Establishments can delete their own expenses"
ON establishment_expenses FOR DELETE
USING (establishment_id IN (
    SELECT id FROM establishments WHERE owner_id = auth.uid()
));

-- Função para calcular total de despesas de um estabelecimento
CREATE OR REPLACE FUNCTION get_establishment_expenses_total(est_id UUID)
RETURNS DECIMAL(10,2) AS $$
BEGIN
    RETURN COALESCE(
        (SELECT SUM(amount) FROM establishment_expenses WHERE establishment_id = est_id),
        0
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para calcular lucro líquido (receita - despesas)
CREATE OR REPLACE FUNCTION get_establishment_net_profit(est_id UUID, gross_revenue DECIMAL(10,2))
RETURNS DECIMAL(10,2) AS $$
BEGIN
    RETURN gross_revenue - get_establishment_expenses_total(est_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verificar se a tabela foi criada
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'establishment_expenses'
ORDER BY ordinal_position; 