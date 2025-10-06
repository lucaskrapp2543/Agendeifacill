-- ================================================
-- SISTEMA DE ANIVERSÁRIOS DE CLIENTES
-- ================================================
-- Este script cria uma tabela para salvar aniversários
-- de clientes no banco de dados Supabase
-- ================================================

-- 1. Criar a tabela de aniversários
CREATE TABLE IF NOT EXISTS client_birthdays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  client_whatsapp TEXT NOT NULL,
  client_name TEXT NOT NULL,
  birthday DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Garantir que cada cliente (whatsapp) tenha apenas um aniversário por estabelecimento
  UNIQUE(establishment_id, client_whatsapp)
);

-- 2. Criar índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_client_birthdays_establishment 
  ON client_birthdays(establishment_id);

CREATE INDEX IF NOT EXISTS idx_client_birthdays_whatsapp 
  ON client_birthdays(client_whatsapp);

CREATE INDEX IF NOT EXISTS idx_client_birthdays_birthday 
  ON client_birthdays(birthday);

-- 3. Habilitar RLS (Row Level Security)
ALTER TABLE client_birthdays ENABLE ROW LEVEL SECURITY;

-- 4. Criar políticas de segurança

-- Política para SELECT (ler aniversários)
CREATE POLICY "Estabelecimentos podem ver aniversários de seus clientes"
  ON client_birthdays
  FOR SELECT
  USING (
    establishment_id IN (
      SELECT id FROM establishments WHERE owner_id = auth.uid()
    )
  );

-- Política para INSERT (criar aniversários)
CREATE POLICY "Estabelecimentos podem criar aniversários de clientes"
  ON client_birthdays
  FOR INSERT
  WITH CHECK (
    establishment_id IN (
      SELECT id FROM establishments WHERE owner_id = auth.uid()
    )
  );

-- Política para UPDATE (atualizar aniversários)
CREATE POLICY "Estabelecimentos podem atualizar aniversários de seus clientes"
  ON client_birthdays
  FOR UPDATE
  USING (
    establishment_id IN (
      SELECT id FROM establishments WHERE owner_id = auth.uid()
    )
  );

-- Política para DELETE (deletar aniversários)
CREATE POLICY "Estabelecimentos podem deletar aniversários de seus clientes"
  ON client_birthdays
  FOR DELETE
  USING (
    establishment_id IN (
      SELECT id FROM establishments WHERE owner_id = auth.uid()
    )
  );

-- 5. Criar função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_client_birthdays_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Criar trigger para atualizar updated_at
DROP TRIGGER IF EXISTS trigger_update_client_birthdays_updated_at ON client_birthdays;
CREATE TRIGGER trigger_update_client_birthdays_updated_at
  BEFORE UPDATE ON client_birthdays
  FOR EACH ROW
  EXECUTE FUNCTION update_client_birthdays_updated_at();

-- ================================================
-- VERIFICAÇÃO
-- ================================================

-- Verificar se a tabela foi criada
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'client_birthdays'
ORDER BY ordinal_position;

-- Verificar políticas RLS
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'client_birthdays';

-- ================================================
-- INSTRUÇÕES DE USO
-- ================================================
-- 1. Copie todo este SQL
-- 2. Acesse o Supabase → SQL Editor
-- 3. Cole e execute
-- 4. Verifique se retornou sucesso
-- ================================================

