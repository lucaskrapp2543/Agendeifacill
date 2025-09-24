-- CORRIGIR POLÍTICAS RLS PARA INCLUIR STATUS 'completed'
-- Execute este script no SQL Editor do Supabase

-- 1. Verificar se a constraint já inclui 'completed'
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'appointments_status_check' 
        AND check_clause LIKE '%completed%'
    ) THEN
        -- Remover constraint antiga
        ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
        
        -- Adicionar nova constraint com 'completed'
        ALTER TABLE appointments ADD CONSTRAINT appointments_status_check 
        CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed'));
        
        RAISE NOTICE 'Constraint atualizada para incluir status completed';
    ELSE
        RAISE NOTICE 'Constraint já inclui status completed';
    END IF;
END $$;

-- 2. Atualizar política RLS para estabelecimentos
DROP POLICY IF EXISTS "Establishments can manage appointment status" ON appointments;

CREATE POLICY "Establishments can manage appointment status"
    ON appointments FOR UPDATE
    USING (auth.uid() = establishment_id)
    WITH CHECK (
        auth.uid() = establishment_id AND 
        status IN ('confirmed', 'cancelled', 'completed')
    );

-- 3. Verificar se as políticas foram atualizadas
SELECT 
    'Políticas atualizadas com sucesso!' as status,
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual 
FROM pg_policies 
WHERE tablename = 'appointments' 
  AND policyname = 'Establishments can manage appointment status';

-- 4. Testar se estabelecimentos podem marcar como completed
SELECT 
    'Teste de permissão:' as teste,
    'Estabelecimentos agora podem marcar agendamentos como completed' as resultado;
