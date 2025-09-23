-- Sistema de Metas Individuais para Profissionais
-- Este script cria a estrutura necessária para armazenar e gerenciar metas mensais dos profissionais

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

-- 5. Função para calcular progresso da meta
CREATE OR REPLACE FUNCTION get_professional_goal_progress(
  p_establishment_id UUID,
  p_professional_id TEXT,
  p_year INTEGER,
  p_month INTEGER
)
RETURNS TABLE (
  goal_amount INTEGER,
  completed_services INTEGER,
  progress_percentage NUMERIC,
  remaining_services INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH goal_data AS (
    SELECT 
      COALESCE(pg.goal_amount, 0) as goal_amount
    FROM professional_goals pg
    WHERE pg.establishment_id = p_establishment_id
      AND pg.professional_id = p_professional_id
      AND pg.year = p_year
      AND pg.month = p_month
  ),
  completed_data AS (
    SELECT COUNT(*)::INTEGER as completed_services
    FROM appointments a
    WHERE a.establishment_id = p_establishment_id
      AND a.professional_name = (
        SELECT name FROM establishments e, jsonb_array_elements(e.professionals) p
        WHERE e.id = p_establishment_id AND p->>'id' = p_professional_id
      )
      AND EXTRACT(YEAR FROM a.appointment_date::DATE) = p_year
      AND EXTRACT(MONTH FROM a.appointment_date::DATE) = p_month
      AND a.status = 'completed'
  )
  SELECT 
    gd.goal_amount,
    cd.completed_services,
    CASE 
      WHEN gd.goal_amount > 0 THEN 
        ROUND((cd.completed_services::NUMERIC / gd.goal_amount::NUMERIC) * 100, 2)
      ELSE 0
    END as progress_percentage,
    GREATEST(gd.goal_amount - cd.completed_services, 0) as remaining_services
  FROM goal_data gd
  CROSS JOIN completed_data cd;
END;
$$ LANGUAGE plpgsql;

-- 6. Função para obter nome do profissional pelo ID
CREATE OR REPLACE FUNCTION get_professional_name(
  p_establishment_id UUID,
  p_professional_id TEXT
)
RETURNS TEXT AS $$
DECLARE
  professional_name TEXT;
BEGIN
  SELECT p->>'name' INTO professional_name
  FROM establishments e, jsonb_array_elements(e.professionals) p
  WHERE e.id = p_establishment_id AND p->>'id' = p_professional_id;
  
  RETURN professional_name;
END;
$$ LANGUAGE plpgsql;

-- 7. Comentários para documentação
COMMENT ON TABLE professional_goals IS 'Armazena metas mensais de serviços para cada profissional';
COMMENT ON COLUMN professional_goals.goal_amount IS 'Quantidade de serviços que o profissional deve realizar no mês';
COMMENT ON COLUMN professional_goals.year IS 'Ano da meta (ex: 2024)';
COMMENT ON COLUMN professional_goals.month IS 'Mês da meta (1-12)';

-- 8. Trigger para atualizar updated_at
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

