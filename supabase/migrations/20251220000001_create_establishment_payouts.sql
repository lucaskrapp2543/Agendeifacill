-- Histórico de pagamentos do admin (suporte) para estabelecimentos
-- Usado para "zerar" o saldo exibido (saldo = vendas líquidas - pagamentos registrados)

CREATE TABLE IF NOT EXISTS public.establishment_payouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  paid_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  note TEXT NULL
);

COMMENT ON TABLE public.establishment_payouts IS 'Pagamentos feitos pelo suporte/admin para repassar saldo ao estabelecimento (controle interno).';
COMMENT ON COLUMN public.establishment_payouts.amount IS 'Valor pago ao estabelecimento (deve corresponder ao saldo liquidado no momento do pagamento).';
COMMENT ON COLUMN public.establishment_payouts.paid_by IS 'Usuário (auth.users) que registrou o pagamento (normalmente suporte).';

CREATE INDEX IF NOT EXISTS idx_establishment_payouts_establishment_id
  ON public.establishment_payouts (establishment_id);

CREATE INDEX IF NOT EXISTS idx_establishment_payouts_created_at
  ON public.establishment_payouts (created_at);

ALTER TABLE public.establishment_payouts ENABLE ROW LEVEL SECURITY;

-- Estabelecimento (dono) pode ver apenas seus próprios pagamentos registrados
CREATE POLICY "Establishments can view their own payouts"
ON public.establishment_payouts FOR SELECT
USING (establishment_id IN (
  SELECT id FROM public.establishments WHERE owner_id = auth.uid()
));

-- Suporte pode ver tudo (para auditoria e controle)
CREATE POLICY "Support can view all payouts"
ON public.establishment_payouts FOR SELECT
USING ((auth.jwt() ->> 'email') = 'suporteagendeifacil@gmail.com');

-- Suporte pode inserir registros de pagamento
CREATE POLICY "Support can insert payouts"
ON public.establishment_payouts FOR INSERT
WITH CHECK ((auth.jwt() ->> 'email') = 'suporteagendeifacil@gmail.com');


