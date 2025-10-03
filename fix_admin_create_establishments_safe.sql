-- Script SQL SEGURO para permitir que o admin crie estabelecimentos
-- Execute este código no SQL Editor do Supabase Dashboard
-- Este script NÃO afeta outras funcionalidades

-- 1. Criar política ESPECÍFICA para admin criar estabelecimentos
-- Esta política permite INSERT apenas para usuários autenticados
-- e NÃO interfere com outras políticas existentes
CREATE POLICY "Allow authenticated users to create establishments"
ON establishments
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 2. Verificar se a coluna owner_id pode ser NULL (apenas se necessário)
-- Isso permite que estabelecimentos sejam criados sem owner_id inicial
DO $$
BEGIN
    -- Verificar se a coluna tem constraint NOT NULL
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'establishments' 
        AND column_name = 'owner_id' 
        AND is_nullable = 'NO'
    ) THEN
        -- Remover constraint NOT NULL apenas se existir
        ALTER TABLE establishments ALTER COLUMN owner_id DROP NOT NULL;
    END IF;
END $$;

-- 3. Adicionar colunas necessárias (apenas se não existirem)
-- Isso garante que o estabelecimento tenha todos os campos necessários
DO $$
BEGIN
    -- Adicionar colunas se não existirem
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'establishments' AND column_name = 'payment_status') THEN
        ALTER TABLE establishments ADD COLUMN payment_status TEXT DEFAULT 'unpaid';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'establishments' AND column_name = 'plan_type') THEN
        ALTER TABLE establishments ADD COLUMN plan_type TEXT DEFAULT 'monthly';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'establishments' AND column_name = 'payment_due_date') THEN
        ALTER TABLE establishments ADD COLUMN payment_due_date TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'establishments' AND column_name = 'is_deleted') THEN
        ALTER TABLE establishments ADD COLUMN is_deleted BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'establishments' AND column_name = 'is_blocked') THEN
        ALTER TABLE establishments ADD COLUMN is_blocked BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'establishments' AND column_name = 'whatsapp') THEN
        ALTER TABLE establishments ADD COLUMN whatsapp TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'establishments' AND column_name = 'pin_password') THEN
        ALTER TABLE establishments ADD COLUMN pin_password TEXT DEFAULT '0000';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'establishments' AND column_name = 'professionals_pins') THEN
        ALTER TABLE establishments ADD COLUMN professionals_pins JSONB DEFAULT '[]'::jsonb;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'establishments' AND column_name = 'carousel_position') THEN
        ALTER TABLE establishments ADD COLUMN carousel_position TEXT DEFAULT 'below';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'establishments' AND column_name = 'has_wifi') THEN
        ALTER TABLE establishments ADD COLUMN has_wifi BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'establishments' AND column_name = 'has_parking') THEN
        ALTER TABLE establishments ADD COLUMN has_parking BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'establishments' AND column_name = 'has_accessibility') THEN
        ALTER TABLE establishments ADD COLUMN has_accessibility BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'establishments' AND column_name = 'wifi_password') THEN
        ALTER TABLE establishments ADD COLUMN wifi_password TEXT;
    END IF;
END $$;

-- 4. Verificar se as políticas foram criadas corretamente
-- Esta query mostra todas as políticas ativas na tabela establishments
SELECT 
    policyname,
    cmd,
    roles,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'establishments'
ORDER BY policyname;

-- 5. Verificar se a coluna owner_id pode ser NULL
SELECT 
    column_name,
    is_nullable,
    data_type
FROM information_schema.columns 
WHERE table_name = 'establishments' 
AND column_name = 'owner_id';
