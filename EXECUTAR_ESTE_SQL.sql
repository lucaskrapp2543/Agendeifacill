-- ===============================================
-- SISTEMA DE CONTROLE DE PAGAMENTOS - PROFISSIONAIS
-- ===============================================
-- COPIE E COLE TODO ESTE CÓDIGO NO SQL EDITOR DO SUPABASE

-- 1. CRIAR TABELA DE PAGAMENTOS
CREATE TABLE IF NOT EXISTS professional_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL,
  professional_name VARCHAR(255) NOT NULL,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. CRIAR ÍNDICES PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_professional_payments_establishment 
ON professional_payments(establishment_id);

CREATE INDEX IF NOT EXISTS idx_professional_payments_professional 
ON professional_payments(professional_id);

CREATE INDEX IF NOT EXISTS idx_professional_payments_date 
ON professional_payments(payment_date);

-- 3. ATIVAR RLS (SEGURANÇA)
ALTER TABLE professional_payments ENABLE ROW LEVEL SECURITY;

-- 4. POLÍTICA: APENAS DONO DO ESTABELECIMENTO VÊ SEUS PAGAMENTOS
CREATE POLICY "Estabelecimentos podem ver seus próprios pagamentos" 
ON professional_payments
FOR SELECT
USING (
  establishment_id IN (
    SELECT id FROM establishments 
    WHERE owner_id = auth.uid()
  )
);

-- 5. POLÍTICA: APENAS DONO DO ESTABELECIMENTO INSERE PAGAMENTOS
CREATE POLICY "Estabelecimentos podem inserir seus próprios pagamentos" 
ON professional_payments
FOR INSERT
WITH CHECK (
  establishment_id IN (
    SELECT id FROM establishments 
    WHERE owner_id = auth.uid()
  )
);

-- 6. POLÍTICA: APENAS DONO DO ESTABELECIMENTO ATUALIZA PAGAMENTOS
CREATE POLICY "Estabelecimentos podem atualizar seus próprios pagamentos" 
ON professional_payments
FOR UPDATE
USING (
  establishment_id IN (
    SELECT id FROM establishments 
    WHERE owner_id = auth.uid()
  )
);

-- 7. POLÍTICA: APENAS DONO DO ESTABELECIMENTO DELETA PAGAMENTOS
CREATE POLICY "Estabelecimentos podem deletar seus próprios pagamentos" 
ON professional_payments
FOR DELETE
USING (
  establishment_id IN (
    SELECT id FROM establishments 
    WHERE owner_id = auth.uid()
  )
);

-- 8. FUNÇÃO PARA ATUALIZAR DATA AUTOMATICAMENTE
CREATE OR REPLACE FUNCTION update_professional_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. TRIGGER PARA ATUALIZAR DATA AUTOMATICAMENTE
CREATE TRIGGER update_professional_payments_updated_at
  BEFORE UPDATE ON professional_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_professional_payments_updated_at();

-- 10. VERIFICAR SE FOI CRIADO CORRETAMENTE
SELECT 
  '✅ TABELA CRIADA COM SUCESSO!' as status,
  COUNT(*) as total_columns
FROM information_schema.columns 
WHERE table_name = 'professional_payments';

-- ===============================================
-- FIM DO SCRIPT
-- ===============================================
