-- Script para adicionar rastreamento de último login do estabelecimento
-- Execute este script no Supabase SQL Editor

-- 1. Adicionar coluna last_login_at na tabela establishments
ALTER TABLE establishments 
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;

-- 2. Adicionar comentário para documentar a coluna
COMMENT ON COLUMN establishments.last_login_at IS 'Data e hora do último acesso do proprietário ao dashboard do estabelecimento';

-- 3. LIMPAR dados incorretos - resetar todos os last_login_at para NULL
-- (depois os triggers vão atualizar automaticamente quando houver atividade real)
UPDATE establishments 
SET last_login_at = NULL;

-- 4. REMOVIDO: Trigger de UPDATE no estabelecimento (estava causando problemas)
-- Agora só atualiza quando:
-- 1. O código do EstablishmentDashboard chama updateEstablishmentLastLogin()
-- 2. Quando recebe novo agendamento

-- 5. Criar função para atualizar o último login quando houver NOVO AGENDAMENTO
CREATE OR REPLACE FUNCTION update_establishment_last_login_on_appointment()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualizar last_login_at do estabelecimento quando criar novo agendamento
  UPDATE establishments
  SET last_login_at = NOW()
  WHERE id = NEW.establishment_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Criar trigger para atualizar last_login_at quando houver NOVO AGENDAMENTO
DROP TRIGGER IF EXISTS trigger_update_establishment_on_appointment ON appointments;

CREATE TRIGGER trigger_update_establishment_on_appointment
  AFTER INSERT ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION update_establishment_last_login_on_appointment();

-- 7. Verificar se a coluna foi criada corretamente
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'establishments' 
  AND column_name = 'last_login_at';

-- 8. Testar: Ver os últimos logins dos estabelecimentos
SELECT 
  id,
  name,
  code,
  created_at,
  last_login_at,
  CASE 
    WHEN last_login_at IS NULL THEN 'Nunca acessou'
    WHEN last_login_at > NOW() - INTERVAL '1 hour' THEN 'Online agora'
    WHEN last_login_at > NOW() - INTERVAL '24 hours' THEN 'Hoje'
    WHEN last_login_at > NOW() - INTERVAL '7 days' THEN 'Esta semana'
    ELSE 'Inativo'
  END as status_acesso
FROM establishments
WHERE (is_deleted = false OR is_deleted IS NULL)
ORDER BY last_login_at DESC NULLS LAST
LIMIT 10;

