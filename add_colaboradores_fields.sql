-- Script para adicionar campos de Colaboradores na tabela establishments
-- Execute este script no Supabase SQL Editor

-- Adicionar campos para funcionalidade de Colaboradores
ALTER TABLE public.establishments 
ADD COLUMN IF NOT EXISTS colaboradores_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS colaboradores_percentage INTEGER DEFAULT 40;

-- Comentários para documentação
COMMENT ON COLUMN public.establishments.colaboradores_enabled IS 'Indica se a funcionalidade de Colaboradores está ativada para este estabelecimento';
COMMENT ON COLUMN public.establishments.colaboradores_percentage IS 'Porcentagem de repasse para colaboradores (0-100)';

-- Verificar se os campos foram adicionados corretamente
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'establishments' 
    AND table_schema = 'public'
    AND column_name IN ('colaboradores_enabled', 'colaboradores_percentage')
ORDER BY column_name;
