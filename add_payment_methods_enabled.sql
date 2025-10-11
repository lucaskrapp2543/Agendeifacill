-- Adicionar campo para controlar formas de pagamento ativas
-- Este campo armazena quais formas de pagamento estão disponíveis para os clientes

-- Adicionar coluna payment_methods_enabled (array de strings)
ALTER TABLE establishments
ADD COLUMN IF NOT EXISTS payment_methods_enabled TEXT[] DEFAULT ARRAY['pix', 'credito', 'debito', 'dinheiro', 'pagar_local'];

-- Comentário explicativo
COMMENT ON COLUMN establishments.payment_methods_enabled IS 'Formas de pagamento ativas no estabelecimento. Valores possíveis: pix, credito, debito, dinheiro, pagar_local';

-- Atualizar estabelecimentos existentes para ter todas as formas ativas por padrão
UPDATE establishments
SET payment_methods_enabled = ARRAY['pix', 'credito', 'debito', 'dinheiro', 'pagar_local']
WHERE payment_methods_enabled IS NULL;

-- Verificar se funcionou
SELECT 
  id,
  name,
  payment_methods_enabled
FROM establishments
LIMIT 5;
