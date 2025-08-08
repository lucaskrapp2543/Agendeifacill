-- Script para verificar e corrigir a tabela client_subscriptions
-- Execute este script no SQL Editor do Supabase

-- 1. Verificar se a tabela existe
SELECT table_name FROM information_schema.tables WHERE table_name = 'client_subscriptions';

-- 2. Verificar estrutura da tabela
SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'client_subscriptions' ORDER BY ordinal_position;

-- 3. Verificar policies existentes
SELECT schemaname, tablename, policyname FROM pg_policies WHERE tablename = 'client_subscriptions';

-- 4. Verificar constraints
SELECT conname, contype FROM pg_constraint WHERE conrelid = 'client_subscriptions'::regclass; 