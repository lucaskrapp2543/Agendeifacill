-- Script para adicionar campo payment_method na tabela appointments
-- Execute este SQL no painel do Supabase (SQL Editor)

-- Adicionar coluna payment_method
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'pendente';

-- Verificar se a coluna foi criada
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'appointments' AND column_name = 'payment_method'; 