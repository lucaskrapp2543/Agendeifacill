-- Verificar se as políticas RLS estão permitindo DELETE
-- Execute este SQL no Supabase SQL Editor

-- 1. Verificar políticas existentes
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
WHERE tablename = 'appointments';

-- 2. Verificar se RLS está habilitado
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'appointments';

-- 3. Criar política de DELETE se não existir
-- Esta política permite que o dono do estabelecimento delete agendamentos
CREATE POLICY IF NOT EXISTS "Estabelecimentos podem deletar seus agendamentos" ON appointments
    FOR DELETE
    USING (
        establishment_id IN (
            SELECT id FROM establishments 
            WHERE owner_id = auth.uid()
        )
    );

-- 4. Verificar se a política foi criada
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd
FROM pg_policies 
WHERE tablename = 'appointments' AND cmd = 'DELETE';

-- 5. Testar DELETE (substitua 'SEU_ESTABLISHMENT_ID' pelo ID real)
-- DELETE FROM appointments WHERE establishment_id = 'SEU_ESTABLISHMENT_ID' LIMIT 1;
