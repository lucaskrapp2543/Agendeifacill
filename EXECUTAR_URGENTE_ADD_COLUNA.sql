-- ⚠️ EXECUTAR URGENTE NO SUPABASE SQL EDITOR ⚠️
-- Este SQL adiciona a coluna que está faltando e causando o erro

ALTER TABLE establishments
ADD COLUMN IF NOT EXISTS use_mercadopago_subscription_pix BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN establishments.use_mercadopago_subscription_pix IS
'Se true, o botão Assinar do Booking gera PIX via Mercado Pago (sem cobrança automática). Exclusão mútua com use_pagarme_subscription_pix.';

-- Verificar se foi criada
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'establishments' 
AND column_name = 'use_mercadopago_subscription_pix';
