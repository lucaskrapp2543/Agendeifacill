-- Histórico de profissionais removidos (soft delete) para permitir reativar e realocar saldo
ALTER TABLE establishments
  ADD COLUMN IF NOT EXISTS deleted_professionals JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN establishments.deleted_professionals IS 'Profissionais removidos da lista ativa (id, name, percentage, etc. + deleted_at). Permite reativar no dashboard financeiro.';
