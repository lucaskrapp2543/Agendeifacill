-- Caixa da barbearia por dia (valor em especie inicial do dia).
-- O total do caixa no frontend e: abertura do dia + vendas em dinheiro.

CREATE TABLE IF NOT EXISTS barbershop_daily_cash (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  cash_date DATE NOT NULL,
  opening_amount DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (opening_amount >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (establishment_id, cash_date)
);

CREATE INDEX IF NOT EXISTS idx_barbershop_daily_cash_est_date
  ON barbershop_daily_cash (establishment_id, cash_date);

ALTER TABLE barbershop_daily_cash ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Establishments can view own barbershop_daily_cash" ON barbershop_daily_cash;
CREATE POLICY "Establishments can view own barbershop_daily_cash"
ON barbershop_daily_cash FOR SELECT
USING (establishment_id IN (SELECT id FROM establishments WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Establishments can insert own barbershop_daily_cash" ON barbershop_daily_cash;
CREATE POLICY "Establishments can insert own barbershop_daily_cash"
ON barbershop_daily_cash FOR INSERT
WITH CHECK (establishment_id IN (SELECT id FROM establishments WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Establishments can update own barbershop_daily_cash" ON barbershop_daily_cash;
CREATE POLICY "Establishments can update own barbershop_daily_cash"
ON barbershop_daily_cash FOR UPDATE
USING (establishment_id IN (SELECT id FROM establishments WHERE owner_id = auth.uid()))
WITH CHECK (establishment_id IN (SELECT id FROM establishments WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Establishments can delete own barbershop_daily_cash" ON barbershop_daily_cash;
CREATE POLICY "Establishments can delete own barbershop_daily_cash"
ON barbershop_daily_cash FOR DELETE
USING (establishment_id IN (SELECT id FROM establishments WHERE owner_id = auth.uid()));
