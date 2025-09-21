-- Sistema de Prontuários de Inscrição
-- Criar tabela para armazenar formulários de inscrição

CREATE TABLE IF NOT EXISTS registration_forms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name VARCHAR(255) NOT NULL,
  establishment_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  ip_address INET,
  user_agent TEXT
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_registration_forms_status ON registration_forms(status);
CREATE INDEX IF NOT EXISTS idx_registration_forms_created_at ON registration_forms(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_registration_forms_email ON registration_forms(email);

-- RLS (Row Level Security)
ALTER TABLE registration_forms ENABLE ROW LEVEL SECURITY;

-- Política: Apenas admins podem ver todos os prontuários
CREATE POLICY "Admins can view all registration forms" ON registration_forms
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.email IN ('admin@agendeifacil.com', 'felipe@agendeifacil.com')
    )
  );

-- Política: Qualquer usuário pode inserir (para o formulário)
CREATE POLICY "Anyone can insert registration forms" ON registration_forms
  FOR INSERT WITH CHECK (true);

-- Comentários para documentação
COMMENT ON TABLE registration_forms IS 'Tabela para armazenar prontuários de inscrição do sistema';
COMMENT ON COLUMN registration_forms.status IS 'Status do prontuário: pending, approved, rejected';
COMMENT ON COLUMN registration_forms.password_hash IS 'Hash da senha fornecida pelo usuário';
COMMENT ON COLUMN registration_forms.processed_by IS 'ID do admin que processou o prontuário';
