-- Vendas avulsas de produtos (sem precisar de agendamento)
-- Usado em "Meus Produtos" -> "Vendas por Funcionário" (botão VENDER)

CREATE TABLE IF NOT EXISTS public.product_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.establishment_products(id) ON DELETE CASCADE,
  professional_id TEXT,
  professional_name TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC NOT NULL CHECK (unit_price >= 0),
  sold_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_sales_establishment_sold_at
  ON public.product_sales (establishment_id, sold_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_sales_product_sold_at
  ON public.product_sales (product_id, sold_at DESC);

ALTER TABLE public.product_sales ENABLE ROW LEVEL SECURITY;

-- Mesma filosofia do projeto: acesso é controlado pela senha no app, não por RLS.
DROP POLICY IF EXISTS "Authenticated users can manage product sales" ON public.product_sales;
CREATE POLICY "Authenticated users can manage product sales"
ON public.product_sales
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);


