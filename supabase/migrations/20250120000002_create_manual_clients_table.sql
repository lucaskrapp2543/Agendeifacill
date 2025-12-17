-- Criar tabela para clientes manuais
-- Permite que clientes adicionados manualmente sejam salvos no banco e acessíveis de qualquer navegador

CREATE TABLE IF NOT EXISTS manual_clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  birthday DATE,
  alert TEXT, -- Campo de alerta/anotação (máximo 100 caracteres)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(establishment_id, whatsapp) -- Garante que não há duplicatas por estabelecimento
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_manual_clients_establishment_id ON manual_clients(establishment_id);
CREATE INDEX IF NOT EXISTS idx_manual_clients_whatsapp ON manual_clients(whatsapp);

-- RLS (Row Level Security)
ALTER TABLE manual_clients ENABLE ROW LEVEL SECURITY;

-- Policy: Estabelecimentos podem gerenciar seus próprios clientes manuais
CREATE POLICY "Establishments can manage their own manual clients"
ON manual_clients
FOR ALL
USING (
  establishment_id IN (
    SELECT id FROM establishments WHERE owner_id = auth.uid()
  )
);

-- Comentários
COMMENT ON TABLE manual_clients IS 'Clientes adicionados manualmente pelos estabelecimentos';
COMMENT ON COLUMN manual_clients.whatsapp IS 'WhatsApp do cliente (apenas números, sem formatação)';
COMMENT ON COLUMN manual_clients.alert IS 'Alerta/anotação sobre o cliente (máximo 100 caracteres)';
