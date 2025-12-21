-- =====================================================
-- SQL SEGURO: Sistema de Pagamento Antecipado
-- =====================================================
-- Este SQL APENAS ADICIONA campos novos
-- NÃO MODIFICA nada que já existe
-- Sistema continua funcionando NORMAL para quem não ativar
-- =====================================================

-- =====================================================
-- PARTE 1: Adicionar 'pending_payment' ao ENUM (se necessário)
-- =====================================================
-- Execute esta parte PRIMEIRO
ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'pending_payment';

-- =====================================================
-- PARTE 2: Adicionar campos novos (SEM MODIFICAR NADA EXISTENTE)
-- =====================================================

-- =====================================================
-- 1. ESTABLISHMENTS: Apenas ADICIONAR campos novos
-- =====================================================

-- Adicionar campo para exigir pagamento antecipado (padrão: false = desativado)
ALTER TABLE establishments
ADD COLUMN IF NOT EXISTS exigir_pagamento_antecipado BOOLEAN DEFAULT false;

-- Adicionar campos de dados bancários (NULL = não cadastrado ainda)
ALTER TABLE establishments
ADD COLUMN IF NOT EXISTS bank_cpf_cnpj TEXT,
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS bank_agency TEXT,
ADD COLUMN IF NOT EXISTS bank_account TEXT;

-- Adicionar campo para ID do recebedor na Pagar.me (NULL = não criado ainda)
ALTER TABLE establishments
ADD COLUMN IF NOT EXISTS pagarme_recipient_id TEXT;

-- Garantir que estabelecimentos existentes tenham false (já está no DEFAULT, mas garantindo)
UPDATE establishments
SET exigir_pagamento_antecipado = false
WHERE exigir_pagamento_antecipado IS NULL;

-- =====================================================
-- 2. APPOINTMENTS: Apenas ADICIONAR campos novos
-- =====================================================

-- Adicionar campo de status do pagamento (padrão: 'pending' = não pago ainda)
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';

-- Adicionar constraint apenas se a coluna foi criada agora
DO $$
BEGIN
    -- Se payment_status acabou de ser criado, adicionar constraint
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' 
        AND column_name = 'payment_status'
        AND column_default = '''pending''::text'
    ) THEN
        -- Adicionar constraint apenas se não existir
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.check_constraints
            WHERE constraint_name = 'appointments_payment_status_check'
        ) THEN
            ALTER TABLE appointments
            ADD CONSTRAINT appointments_payment_status_check 
            CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded'));
        END IF;
    END IF;
END $$;

-- Adicionar campo para ID da transação (NULL = não tem transação ainda)
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS payment_transaction_id TEXT;

-- Para payment_method: NÃO MEXER se já existe!
-- Apenas adicionar constraint se a coluna foi criada agora
DO $$
BEGIN
    -- Se payment_method NÃO existe, criar com constraint
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' 
        AND column_name = 'payment_method'
    ) THEN
        ALTER TABLE appointments
        ADD COLUMN payment_method TEXT 
        CHECK (payment_method IS NULL OR payment_method IN ('pix', 'credit_card', 'debit_card', 'credito', 'debito', 'dinheiro', 'pendente'));
    END IF;
    -- Se já existe, NÃO FAZER NADA - deixar como está!
END $$;

-- =====================================================
-- FIM - Nada mais é modificado!
-- =====================================================
-- O sistema continua funcionando EXATAMENTE como antes
-- Apenas quem ATIVAR a opção "exigir_pagamento_antecipado" 
-- terá o novo comportamento
-- =====================================================





