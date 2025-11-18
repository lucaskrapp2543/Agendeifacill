-- ================================================
-- SISTEMA DE ALERTAS DE CLIENTES
-- ================================================
-- Este script cria uma tabela para salvar alertas/anotações
-- de clientes no banco de dados Supabase
-- ================================================

-- 1. Criar a tabela de alertas
CREATE TABLE IF NOT EXISTS client_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  client_whatsapp TEXT NOT NULL,
  client_name TEXT NOT NULL,
  alert TEXT, -- Anotação de até 100 caracteres (pode ser null)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Garantir que cada cliente (whatsapp) tenha apenas um alerta por estabelecimento
  UNIQUE(establishment_id, client_whatsapp)
);

-- 2. Criar índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_client_alerts_establishment 
  ON client_alerts(establishment_id);

CREATE INDEX IF NOT EXISTS idx_client_alerts_whatsapp 
  ON client_alerts(client_whatsapp);

-- 3. Habilitar RLS (Row Level Security)
ALTER TABLE client_alerts ENABLE ROW LEVEL SECURITY;

-- 4. Criar políticas de segurança

-- Política para SELECT (ler alertas)
CREATE POLICY "Estabelecimentos podem ver alertas de seus clientes"
  ON client_alerts
  FOR SELECT
  USING (
    establishment_id IN (
      SELECT id FROM establishments WHERE owner_id = auth.uid()
    )
  );

-- Política para INSERT (criar alertas)
CREATE POLICY "Estabelecimentos podem criar alertas de clientes"
  ON client_alerts
  FOR INSERT
  WITH CHECK (
    establishment_id IN (
      SELECT id FROM establishments WHERE owner_id = auth.uid()
    )
  );

-- Política para UPDATE (atualizar alertas)
CREATE POLICY "Estabelecimentos podem atualizar alertas de seus clientes"
  ON client_alerts
  FOR UPDATE
  USING (
    establishment_id IN (
      SELECT id FROM establishments WHERE owner_id = auth.uid()
    )
  );

-- Política para DELETE (deletar alertas)
CREATE POLICY "Estabelecimentos podem deletar alertas de seus clientes"
  ON client_alerts
  FOR DELETE
  USING (
    establishment_id IN (
      SELECT id FROM establishments WHERE owner_id = auth.uid()
    )
  );

-- 5. Criar função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_client_alerts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Criar trigger para atualizar updated_at
CREATE TRIGGER update_client_alerts_updated_at
  BEFORE UPDATE ON client_alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_client_alerts_updated_at();

-- 7. Adicionar constraint para limitar tamanho do alerta (100 caracteres)
ALTER TABLE client_alerts
ADD CONSTRAINT check_alert_length CHECK (char_length(alert) <= 100 OR alert IS NULL);

-- Comentários para documentação
COMMENT ON TABLE client_alerts IS 'Tabela para armazenar alertas/anotações sobre clientes (ex: "esse cliente falta pagar 50 reais")';
COMMENT ON COLUMN client_alerts.alert IS 'Anotação sobre o cliente, máximo 100 caracteres. Pode ser null se não houver alerta.';

