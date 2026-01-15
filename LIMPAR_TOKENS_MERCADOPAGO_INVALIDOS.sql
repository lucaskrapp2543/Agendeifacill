-- Script para limpar tokens inválidos do Mercado Pago
-- Execute apenas se você tiver tokens salvos mas a conexão não funcionou

-- Limpar todos os tokens do Mercado Pago (use com cuidado!)
UPDATE establishments
SET 
  mercadopago_user_id = NULL,
  mercadopago_access_token = NULL,
  mercadopago_refresh_token = NULL,
  mercadopago_token_expires_at = NULL
WHERE 
  mercadopago_access_token IS NOT NULL
  -- Adicione uma condição aqui se quiser limpar apenas de um estabelecimento específico
  -- AND id = 'seu-establishment-id-aqui'
;

-- Verificar quantos estabelecimentos têm tokens
SELECT 
  id,
  name,
  mercadopago_user_id,
  CASE 
    WHEN mercadopago_access_token IS NOT NULL THEN 'Tem token'
    ELSE 'Sem token'
  END as status_token
FROM establishments
WHERE mercadopago_access_token IS NOT NULL;
