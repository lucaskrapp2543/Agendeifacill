-- =====================================================
-- SQL COMPLETO: Sistema de Pagamento Antecipado (CORRIGIDO)
-- =====================================================
-- Execute este SQL no Supabase SQL Editor
-- IMPORTANTE: Execute em 2 partes separadas!
-- =====================================================

-- =====================================================
-- PARTE 1: Adicionar 'pending_payment' ao ENUM
-- =====================================================
-- Execute esta parte PRIMEIRO (fora de qualquer transação)
ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'pending_payment';

-- =====================================================
-- PARTE 2: Resto do script (execute após a parte 1)
-- =====================================================

-- =====================================================
-- 1. ESTABLISHMENTS: Dados Bancários e Pagar.me
-- =====================================================

-- Adicionar campo para exigir pagamento antecipado
ALTER TABLE establishments
ADD COLUMN IF NOT EXISTS exigir_pagamento_antecipado BOOLEAN DEFAULT false;

-- Adicionar campos de dados bancários
ALTER TABLE establishments
ADD COLUMN IF NOT EXISTS bank_cpf_cnpj TEXT,
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS bank_agency TEXT,
ADD COLUMN IF NOT EXISTS bank_account TEXT;

-- Adicionar campo para ID do recebedor na Pagar.me
ALTER TABLE establishments
ADD COLUMN IF NOT EXISTS pagarme_recipient_id TEXT;

-- Atualizar estabelecimentos existentes (padrão: false)
UPDATE establishments
SET exigir_pagamento_antecipado = false
WHERE exigir_pagamento_antecipado IS NULL;

-- Comentários para documentação
COMMENT ON COLUMN establishments.exigir_pagamento_antecipado IS 'Exigir pagamento antecipado para todos os agendamentos';
COMMENT ON COLUMN establishments.bank_cpf_cnpj IS 'CPF ou CNPJ do estabelecimento para recebimento';
COMMENT ON COLUMN establishments.bank_name IS 'Nome do banco';
COMMENT ON COLUMN establishments.bank_agency IS 'Agência bancária';
COMMENT ON COLUMN establishments.bank_account IS 'Número da conta bancária';
COMMENT ON COLUMN establishments.pagarme_recipient_id IS 'ID do recebedor criado na Pagar.me para pagamentos antecipados';

-- =====================================================
-- 2. APPOINTMENTS: Campos de Pagamento
-- =====================================================

-- Adicionar campos de pagamento (verificando se já existem)
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending' 
    CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded'));

ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS payment_transaction_id TEXT;

-- Para payment_method, vamos verificar se já existe e ajustar
DO $$
BEGIN
    -- Se payment_method não existe, criar
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' 
        AND column_name = 'payment_method'
    ) THEN
        ALTER TABLE appointments
        ADD COLUMN payment_method TEXT 
        CHECK (payment_method IN ('pix', 'credit_card', 'debit_card', 'credito', 'debito', 'dinheiro', 'pendente'));
    ELSE
        -- Se já existe, primeiro remover constraint antigo
        ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_payment_method_check;
        
        -- Verificar se há valores inválidos antes de atualizar
        IF EXISTS (
            SELECT 1 FROM appointments
            WHERE payment_method IS NOT NULL 
            AND payment_method NOT IN ('pix', 'credit_card', 'debit_card', 'credito', 'debito', 'dinheiro', 'pendente')
            LIMIT 1
        ) THEN
            -- Só desabilita triggers se realmente precisar atualizar
            -- Desabilitar apenas o trigger de conflito (se existir)
            ALTER TABLE appointments DISABLE TRIGGER check_appointment_conflict_trigger;
            
            -- Atualizar valores inválidos para 'pendente' (padrão)
            UPDATE appointments
            SET payment_method = 'pendente'
            WHERE payment_method IS NOT NULL 
            AND payment_method NOT IN ('pix', 'credit_card', 'debit_card', 'credito', 'debito', 'dinheiro', 'pendente');
            
            -- Reabilitar trigger
            ALTER TABLE appointments ENABLE TRIGGER check_appointment_conflict_trigger;
        END IF;
        
        -- Agora adicionar o novo constraint
        ALTER TABLE appointments
        ADD CONSTRAINT appointments_payment_method_check 
        CHECK (payment_method IS NULL OR payment_method IN ('pix', 'credit_card', 'debit_card', 'credito', 'debito', 'dinheiro', 'pendente'));
    END IF;
END $$;

-- Atualizar payment_status existente para 'pending' se NULL
UPDATE appointments
SET payment_status = 'pending'
WHERE payment_status IS NULL;

-- Comentários para documentação
COMMENT ON COLUMN appointments.payment_status IS 'Status do pagamento: pending, paid, failed, refunded';
COMMENT ON COLUMN appointments.payment_transaction_id IS 'ID da transação na Pagar.me';
COMMENT ON COLUMN appointments.payment_method IS 'Método de pagamento utilizado';

-- =====================================================
-- 3. VERIFICAÇÃO FINAL
-- =====================================================

-- Verificar campos em establishments
SELECT 
    'ESTABLISHMENTS' as tabela,
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'establishments' 
AND column_name IN (
    'exigir_pagamento_antecipado',
    'bank_cpf_cnpj',
    'bank_name',
    'bank_agency',
    'bank_account',
    'pagarme_recipient_id'
)
ORDER BY column_name;

-- Verificar campos em appointments
SELECT 
    'APPOINTMENTS' as tabela,
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'appointments' 
AND column_name IN (
    'payment_status',
    'payment_transaction_id',
    'payment_method'
)
ORDER BY column_name;

-- Verificar valores do enum appointment_status
SELECT 
    'ENUM appointment_status' as info,
    enumlabel as valor
FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'appointment_status')
ORDER BY enumsortorder;

-- =====================================================
-- FIM DO SCRIPT
-- =====================================================

