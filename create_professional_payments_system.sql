-- Sistema de Controle de Pagamentos para Profissionais
-- Execute este script no SQL Editor do Supabase

-- 1. Criar tabela para armazenar pagamentos de profissionais
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

-- 2. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_professional_payments_establishment 
ON professional_payments(establishment_id);

CREATE INDEX IF NOT EXISTS idx_professional_payments_professional 
ON professional_payments(professional_id);

CREATE INDEX IF NOT EXISTS idx_professional_payments_date 
ON professional_payments(payment_date);

-- 3. Configurar RLS (Row Level Security)
ALTER TABLE professional_payments ENABLE ROW LEVEL SECURITY;

-- 4. Política para permitir que apenas o dono do estabelecimento veja seus pagamentos
CREATE POLICY "Estabelecimentos podem ver seus próprios pagamentos" 
ON professional_payments
FOR SELECT
USING (
  establishment_id IN (
    SELECT id FROM establishments 
    WHERE owner_id = auth.uid()
  )
);

-- 5. Política para permitir que apenas o dono do estabelecimento insira pagamentos
CREATE POLICY "Estabelecimentos podem inserir seus próprios pagamentos" 
ON professional_payments
FOR INSERT
WITH CHECK (
  establishment_id IN (
    SELECT id FROM establishments 
    WHERE owner_id = auth.uid()
  )
);

-- 6. Política para permitir que apenas o dono do estabelecimento atualize pagamentos
CREATE POLICY "Estabelecimentos podem atualizar seus próprios pagamentos" 
ON professional_payments
FOR UPDATE
USING (
  establishment_id IN (
    SELECT id FROM establishments 
    WHERE owner_id = auth.uid()
  )
);

-- 7. Política para permitir que apenas o dono do estabelecimento delete pagamentos
CREATE POLICY "Estabelecimentos podem deletar seus próprios pagamentos" 
ON professional_payments
FOR DELETE
USING (
  establishment_id IN (
    SELECT id FROM establishments 
    WHERE owner_id = auth.uid()
  )
);

-- 8. Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_professional_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. Trigger para atualizar updated_at
CREATE TRIGGER update_professional_payments_updated_at
  BEFORE UPDATE ON professional_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_professional_payments_updated_at();

-- 10. Comentários para documentação
COMMENT ON TABLE professional_payments IS 'Controle de pagamentos feitos aos profissionais';
COMMENT ON COLUMN professional_payments.establishment_id IS 'ID do estabelecimento que fez o pagamento';
COMMENT ON COLUMN professional_payments.professional_id IS 'ID do profissional que recebeu o pagamento';
COMMENT ON COLUMN professional_payments.professional_name IS 'Nome do profissional (para histórico)';
COMMENT ON COLUMN professional_payments.amount IS 'Valor pago ao profissional';
COMMENT ON COLUMN professional_payments.payment_date IS 'Data em que o pagamento foi realizado';

-- 11. Verificar se a tabela foi criada corretamente
SELECT 
  'Tabela professional_payments criada com sucesso!' as status,
  COUNT(*) as total_columns
FROM information_schema.columns 
WHERE table_name = 'professional_payments';
