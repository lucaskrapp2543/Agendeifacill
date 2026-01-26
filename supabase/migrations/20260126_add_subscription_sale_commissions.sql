-- Comissão por venda de assinatura (paga uma única vez)
-- NÃO é atendimento. Serve apenas para somar valor ao "caixa do profissional" (repasse) no mês.

CREATE TABLE IF NOT EXISTS subscription_sale_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  establishment_id UUID REFERENCES public.establishments(id) ON DELETE CASCADE NOT NULL,
  client_subscription_id UUID REFERENCES public.client_subscriptions(id) ON DELETE CASCADE NOT NULL,
  professional_name TEXT NOT NULL,
  commission_percent NUMERIC(5,2) NOT NULL CHECK (commission_percent >= 0 AND commission_percent <= 100),
  commission_amount NUMERIC(10,2) NOT NULL CHECK (commission_amount >= 0)
);

-- Uma comissão por assinatura do cliente (uma venda / um pagamento)
CREATE UNIQUE INDEX IF NOT EXISTS ux_subscription_sale_commissions_client_subscription
  ON subscription_sale_commissions (client_subscription_id);

CREATE INDEX IF NOT EXISTS idx_subscription_sale_commissions_establishment_created
  ON subscription_sale_commissions (establishment_id, created_at);

CREATE INDEX IF NOT EXISTS idx_subscription_sale_commissions_professional_created
  ON subscription_sale_commissions (professional_name, created_at);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_subscription_sale_commissions_updated_at ON subscription_sale_commissions;
CREATE TRIGGER trg_subscription_sale_commissions_updated_at
BEFORE UPDATE ON subscription_sale_commissions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE subscription_sale_commissions ENABLE ROW LEVEL SECURITY;

-- Políticas: dono do estabelecimento pode ver/manter suas comissões
CREATE POLICY "Establishment owners can select subscription sale commissions"
  ON subscription_sale_commissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.establishments
      WHERE id = establishment_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "Establishment owners can insert subscription sale commissions"
  ON subscription_sale_commissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.establishments
      WHERE id = establishment_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "Establishment owners can update subscription sale commissions"
  ON subscription_sale_commissions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.establishments
      WHERE id = establishment_id AND owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.establishments
      WHERE id = establishment_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "Establishment owners can delete subscription sale commissions"
  ON subscription_sale_commissions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.establishments
      WHERE id = establishment_id AND owner_id = auth.uid()
    )
  );

