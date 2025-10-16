-- Script para adicionar as colunas 'professional' e 'expense_date' à tabela establishment_expenses
-- Execute este script se a tabela já existir e você quiser adicionar as novas colunas

-- Adicionar a coluna professional se ela não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'establishment_expenses' 
        AND column_name = 'professional'
    ) THEN
        ALTER TABLE establishment_expenses 
        ADD COLUMN professional TEXT;
        
        -- Adicionar comentário
        COMMENT ON COLUMN establishment_expenses.professional IS 'Nome do profissional que registrou a despesa';
        
        RAISE NOTICE 'Coluna professional adicionada com sucesso à tabela establishment_expenses';
    ELSE
        RAISE NOTICE 'Coluna professional já existe na tabela establishment_expenses';
    END IF;
END $$;

-- Adicionar a coluna expense_date se ela não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'establishment_expenses' 
        AND column_name = 'expense_date'
    ) THEN
        ALTER TABLE establishment_expenses 
        ADD COLUMN expense_date DATE DEFAULT CURRENT_DATE;
        
        -- Adicionar comentário
        COMMENT ON COLUMN establishment_expenses.expense_date IS 'Data específica da despesa (para filtro por mês)';
        
        RAISE NOTICE 'Coluna expense_date adicionada com sucesso à tabela establishment_expenses';
    ELSE
        RAISE NOTICE 'Coluna expense_date já existe na tabela establishment_expenses';
    END IF;
END $$;
