-- =====================================================
-- SQL COMPLETO: Sistema de Pagamento Antecipado
-- =====================================================
-- Execute este SQL no Supabase SQL Editor
-- Este script adiciona todos os campos necessários para o sistema de pagamento antecipado
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

-- Adicionar 'pending_payment' ao enum appointment_status
-- Primeiro, verificar se é ENUM e adicionar o valor
DO $$
BEGIN
    -- Verificar se o tipo appointment_status existe (é ENUM)
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_status') THEN
        -- Adicionar 'pending_payment' ao enum (só funciona em transação separada)
        -- Nota: ALTER TYPE ... ADD VALUE não pode ser executado dentro de um bloco de transação
        -- Então vamos fazer isso diretamente
        BEGIN
            ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'pending_payment';
        EXCEPTION
            WHEN duplicate_object THEN
                -- Valor já existe, ignorar
                NULL;
        END;
    ELSE
        -- Se não for ENUM, é TEXT com CHECK - remover constraint e adicionar novo
        ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
        ALTER TABLE appointments 
        ADD CONSTRAINT appointments_status_check 
        CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'pending_payment'));
    END IF;
END $$;

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
        -- Se já existe, atualizar o CHECK para incluir novos valores
        ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_payment_method_check;
        ALTER TABLE appointments
        ADD CONSTRAINT appointments_payment_method_check 
        CHECK (payment_method IN ('pix', 'credit_card', 'debit_card', 'credito', 'debito', 'dinheiro', 'pendente'));
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

-- Verificar constraint de status em appointments
SELECT 
    constraint_name,
    check_clause
FROM information_schema.check_constraints
WHERE constraint_name LIKE '%status%'
AND constraint_name LIKE '%appointments%';

-- =====================================================
-- FIM DO SCRIPT
-- =====================================================

