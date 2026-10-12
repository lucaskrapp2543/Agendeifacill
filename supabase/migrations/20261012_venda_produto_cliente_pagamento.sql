-- ============================================================================
-- Venda de produto (agenda → "Vender produto" e "Meus produtos"):
-- guardar a FORMA DE PAGAMENTO e o CLIENTE que comprou.
-- ----------------------------------------------------------------------------
-- MOTIVO: o dono quer saber, em cada venda de produto, como o cliente pagou e
-- quem comprou (cliente da lista "Meus Clientes" ou só o nome de um cliente novo).
--
-- O QUE FAZ: acrescenta 3 colunas VAZIAS em product_sales. As vendas antigas
-- ficam como estão (sem forma de pagamento / sem cliente).
--
-- RISCO: nenhum para os números. Não mexe em quantidade, preço, comissão,
-- estoque, policies nem nas vendas existentes. Só passa a guardar 2 informações
-- a mais nas vendas novas.
-- ============================================================================
ALTER TABLE public.product_sales
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS client_name text,
  ADD COLUMN IF NOT EXISTS client_whatsapp text;

-- Faz a API enxergar as colunas novas na hora.
NOTIFY pgrst, 'reload schema';
