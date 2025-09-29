-- Adicionar coluna is_avulso para reservas avulsas
-- Execute este script no SQL Editor do Supabase

-- 1. Adicionar coluna is_avulso
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS is_avulso BOOLEAN DEFAULT FALSE;

-- 2. Adicionar coluna created_by para identificar quem criou o agendamento
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS created_by TEXT DEFAULT 'client';

-- 3. Verificar se as colunas foram criadas
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'appointments'
AND column_name IN ('is_avulso', 'created_by');

-- 4. Confirmar criação
SELECT 'Colunas is_avulso e created_by criadas com sucesso!' as status;
