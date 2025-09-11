-- Script para remover as colunas de Colaboradores da tabela establishments
-- Execute este script para remover completamente a funcionalidade de Colaboradores

-- Remover as colunas da tabela establishments
ALTER TABLE public.establishments
DROP COLUMN IF EXISTS colaboradores_enabled,
DROP COLUMN IF EXISTS colaboradores_percentage;

-- Verificar se as colunas foram removidas
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

-- Se não retornar nenhuma linha, as colunas foram removidas com sucesso
