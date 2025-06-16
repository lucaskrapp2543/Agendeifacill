-- Script para corrigir problemas de RLS na tabela appointments
-- Execute este script no SQL Editor do Supabase

-- 1. Verificar políticas atuais
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'appointments';

-- 2. Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Users can view their own appointments" ON appointments;
DROP POLICY IF EXISTS "Users can insert their own appointments" ON appointments;
DROP POLICY IF EXISTS "Users can update their own appointments" ON appointments;
DROP POLICY IF EXISTS "Users can delete their own appointments" ON appointments;
DROP POLICY IF EXISTS "Establishments can view their appointments" ON appointments;

-- 3. Desabilitar RLS temporariamente para teste
-- CUIDADO: Isso permite acesso total à tabela
-- ALTER TABLE appointments DISABLE ROW LEVEL SECURITY;

-- 4. OU manter RLS mas criar políticas mais permissivas
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Política para clientes visualizarem seus agendamentos
CREATE POLICY "Clients can view their appointments" ON appointments
  FOR SELECT 
  USING (auth.uid() = client_id::uuid);

-- Política para clientes criarem agendamentos
CREATE POLICY "Clients can create appointments" ON appointments
  FOR INSERT 
  WITH CHECK (auth.uid() = client_id::uuid);

-- Política para clientes atualizarem seus agendamentos (cancelar)
CREATE POLICY "Clients can update their appointments" ON appointments
  FOR UPDATE 
  USING (auth.uid() = client_id::uuid)
  WITH CHECK (auth.uid() = client_id::uuid);

-- Política para estabelecimentos visualizarem agendamentos
CREATE POLICY "Establishments can view their appointments" ON appointments
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM establishments 
      WHERE id = establishment_id 
      AND owner_id = auth.uid()
    )
  );

-- Política para estabelecimentos atualizarem agendamentos
CREATE POLICY "Establishments can update their appointments" ON appointments
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM establishments 
      WHERE id = establishment_id 
      AND owner_id = auth.uid()
    )
  );

-- 5. Verificar se as políticas foram criadas
SELECT schemaname, tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename = 'appointments';

-- 6. Testar se o RLS está funcionando
-- SELECT * FROM appointments WHERE client_id = auth.uid(); 