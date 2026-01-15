-- Migração: Adicionar campos de pagamento antecipado via Mercado Pago
-- Similar ao sistema de pagamento antecipado do Pagar.me

-- Adicionar campo para exigir pagamento antecipado via Mercado Pago
ALTER TABLE establishments
ADD COLUMN IF NOT EXISTS exigir_pagamento_antecipado_mercadopago BOOLEAN DEFAULT false;

-- Adicionar campo para pagamento antecipado opcional via Mercado Pago
ALTER TABLE establishments
ADD COLUMN IF NOT EXISTS pagamento_adiantado_opcional_mercadopago BOOLEAN DEFAULT false;

-- Atualizar estabelecimentos existentes (padrão: false)
UPDATE establishments
SET exigir_pagamento_antecipado_mercadopago = false,
    pagamento_adiantado_opcional_mercadopago = false
WHERE exigir_pagamento_antecipado_mercadopago IS NULL
   OR pagamento_adiantado_opcional_mercadopago IS NULL;

-- Comentários para documentação
COMMENT ON COLUMN establishments.exigir_pagamento_antecipado_mercadopago IS 'Exigir pagamento antecipado via Mercado Pago para todos os agendamentos';
COMMENT ON COLUMN establishments.pagamento_adiantado_opcional_mercadopago IS 'Quando TRUE: cliente pode finalizar agendamento sem pagar, mas verá opção "pagar agora" via Mercado Pago. Quando FALSE: se pagamento antecipado estiver ativo, o pagamento é obrigatório para confirmar.';
