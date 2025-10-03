-- Script SQL para permitir que o admin crie estabelecimentos
-- Execute este código no SQL Editor do Supabase Dashboard

-- 1. Remover políticas existentes que podem estar bloqueando
DROP POLICY IF EXISTS "Owners can manage their establishments" ON establishments;
DROP POLICY IF EXISTS "Public and authenticated can view establishments" ON establishments;
DROP POLICY IF EXISTS "All users can view establishments" ON establishments;
DROP POLICY IF EXISTS "Establishment owners can update their own establishment" ON establishments;
DROP POLICY IF EXISTS "Public can view establishment details" ON establishments;

-- 2. Criar nova política que permite admin criar estabelecimentos
CREATE POLICY "Admin can create establishments"
ON establishments
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 3. Criar política para proprietários gerenciarem seus estabelecimentos
CREATE POLICY "Owners can manage their establishments"
ON establishments
FOR ALL
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- 4. Criar política para visualização pública
CREATE POLICY "Public can view establishments"
ON establishments
FOR SELECT
TO anon, authenticated
USING (true);

-- 5. Conceder permissões explícitas
GRANT SELECT ON establishments TO anon;
GRANT ALL ON establishments TO authenticated;

-- 6. Verificar se a tabela establishments tem as colunas necessárias
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

-- 7. Verificar se a coluna owner_id pode ser NULL
ALTER TABLE establishments ALTER COLUMN owner_id DROP NOT NULL;

-- 8. Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_establishments_code ON establishments(code);
CREATE INDEX IF NOT EXISTS idx_establishments_owner_id ON establishments(owner_id);

-- 9. Verificar se as políticas foram criadas corretamente
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'establishments'
ORDER BY policyname;
