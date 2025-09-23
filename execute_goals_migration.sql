-- Script para executar a migração do sistema de metas
-- Execute este script no Supabase SQL Editor

-- 1. Criar tabela para armazenar metas dos profissionais
CREATE TABLE IF NOT EXISTS professional_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID REFERENCES establishments(id) ON DELETE CASCADE NOT NULL,
  professional_id TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL, -- 1-12
  goal_amount INTEGER NOT NULL, -- Meta de serviços (ex: 10, 20, 50)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Garantir que cada profissional tenha apenas uma meta por mês
  UNIQUE(establishment_id, professional_id, year, month)
);

-- 2. Habilitar Row Level Security
ALTER TABLE professional_goals ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de acesso
-- Estabelecimentos podem gerenciar suas próprias metas
CREATE POLICY "Establishments can manage their professional goals"
  ON professional_goals
  FOR ALL
  USING (
    establishment_id IN (
      SELECT id FROM establishments WHERE owner_id = auth.uid()
    )
  );

-- 4. Índices para performance
CREATE INDEX IF NOT EXISTS idx_professional_goals_establishment_professional 
  ON professional_goals(establishment_id, professional_id);

CREATE INDEX IF NOT EXISTS idx_professional_goals_year_month 
  ON professional_goals(year, month);

-- 5. Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_professional_goals_updated_at 
  BEFORE UPDATE ON professional_goals 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Verificar se a tabela foi criada com sucesso
SELECT 'Sistema de metas criado com sucesso!' as status;
