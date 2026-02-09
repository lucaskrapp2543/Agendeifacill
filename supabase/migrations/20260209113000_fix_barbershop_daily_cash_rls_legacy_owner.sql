-- Corrige RLS do caixa diario para compatibilidade com estabelecimentos legados
-- (alguns registros antigos podem nao ter owner_id preenchido corretamente).
-- Mantem seguranca: so permite quando auth.uid() e dono (owner_id) OU id legado do estabelecimento.

DROP POLICY IF EXISTS "Establishments can view own barbershop_daily_cash" ON barbershop_daily_cash;
CREATE POLICY "Establishments can view own barbershop_daily_cash"
ON barbershop_daily_cash FOR SELECT
USING (
  establishment_id IN (
    SELECT id
    FROM establishments
    WHERE owner_id = auth.uid() OR id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Establishments can insert own barbershop_daily_cash" ON barbershop_daily_cash;
CREATE POLICY "Establishments can insert own barbershop_daily_cash"
ON barbershop_daily_cash FOR INSERT
WITH CHECK (
  establishment_id IN (
    SELECT id
    FROM establishments
    WHERE owner_id = auth.uid() OR id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Establishments can update own barbershop_daily_cash" ON barbershop_daily_cash;
CREATE POLICY "Establishments can update own barbershop_daily_cash"
ON barbershop_daily_cash FOR UPDATE
USING (
  establishment_id IN (
    SELECT id
    FROM establishments
    WHERE owner_id = auth.uid() OR id = auth.uid()
  )
)
WITH CHECK (
  establishment_id IN (
    SELECT id
    FROM establishments
    WHERE owner_id = auth.uid() OR id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Establishments can delete own barbershop_daily_cash" ON barbershop_daily_cash;
CREATE POLICY "Establishments can delete own barbershop_daily_cash"
ON barbershop_daily_cash FOR DELETE
USING (
  establishment_id IN (
    SELECT id
    FROM establishments
    WHERE owner_id = auth.uid() OR id = auth.uid()
  )
);
