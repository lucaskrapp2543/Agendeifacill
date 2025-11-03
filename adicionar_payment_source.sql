-- ===============================================
-- ADICIONAR COLUNA payment_source PARA IDENTIFICAR PAGAMENTOS VIA ASSINATURA
-- ===============================================
-- ✅ ESTE SQL É 100% SEGURO - NÃO QUEBRA NADA EXISTENTE
-- Execute este SQL no Supabase SQL Editor

-- PASSO 1: Verificar se a coluna já existe (segurança extra)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'professional_payments' 
    AND column_name = 'payment_source'
  ) THEN
    -- Só adiciona se não existir
    ALTER TABLE professional_payments
    ADD COLUMN payment_source TEXT DEFAULT 'normal';
    
    RAISE NOTICE '✅ Coluna payment_source criada com sucesso!';
  ELSE
    RAISE NOTICE 'ℹ️ Coluna payment_source já existe, pulando criação.';
  END IF;
END $$;

-- PASSO 2: Garantir que todos os registros antigos tenham 'normal'
-- (Isso é seguro porque só atualiza NULLs, não afeta valores existentes)
UPDATE professional_payments
SET payment_source = 'normal'
WHERE payment_source IS NULL;

-- PASSO 3: Adicionar comentário (opcional, não afeta funcionalidade)
COMMENT ON COLUMN professional_payments.payment_source IS 
'Fonte do pagamento: "subscription" para pagamentos via assinatura, "normal" para pagamentos normais';

-- PASSO 4: Verificar se tudo está OK (apenas visualização, não altera nada)
SELECT 
  '✅ VERIFICAÇÃO' as status,
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'professional_payments' 
  AND column_name = 'payment_source';

-- ===============================================
-- ✅ PRONTO! Agora os pagamentos via assinatura terão payment_source = 'subscription'
-- e os pagamentos normais terão payment_source = 'normal'
-- 
-- 🔒 GARANTIAS DE SEGURANÇA:
-- 1. ✅ Não altera nenhuma coluna existente
-- 2. ✅ Não remove nenhum dado
-- 3. ✅ Não afeta pagamentos já registrados (recebem 'normal' automaticamente)
-- 4. ✅ Código TypeScript já está preparado para coluna opcional
-- 5. ✅ Se a coluna já existir, o SQL simplesmente ignora e continua
-- ===============================================

