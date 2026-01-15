-- Adicionar campos do Mercado Pago na tabela establishments
-- Para armazenar tokens OAuth e user_id dos vendedores conectados

ALTER TABLE establishments
ADD COLUMN IF NOT EXISTS mercadopago_user_id TEXT,
ADD COLUMN IF NOT EXISTS mercadopago_access_token TEXT,
ADD COLUMN IF NOT EXISTS mercadopago_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS mercadopago_token_expires_at TIMESTAMPTZ;

-- Adicionar comentários para documentação
COMMENT ON COLUMN establishments.mercadopago_user_id IS 'User ID do vendedor no Mercado Pago (obtido via OAuth)';
COMMENT ON COLUMN establishments.mercadopago_access_token IS 'Access token do vendedor no Mercado Pago (obtido via OAuth)';
COMMENT ON COLUMN establishments.mercadopago_refresh_token IS 'Refresh token do vendedor no Mercado Pago (para renovar access_token)';
COMMENT ON COLUMN establishments.mercadopago_token_expires_at IS 'Data de expiração do access_token do Mercado Pago';

-- Verificar se as colunas foram criadas
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'establishments' 
AND column_name IN (
    'mercadopago_user_id',
    'mercadopago_access_token',
    'mercadopago_refresh_token',
    'mercadopago_token_expires_at'
)
ORDER BY column_name;
