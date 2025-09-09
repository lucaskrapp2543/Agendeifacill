-- Script COMPLETO para configurar a funcionalidade de remarcação no mesmo dia
-- Execute este script no SQL Editor do Supabase

-- 1. Adicionar campo prevent_same_day_reschedule na tabela establishments
ALTER TABLE establishments 
ADD COLUMN IF NOT EXISTS prevent_same_day_reschedule BOOLEAN DEFAULT false;

-- 2. Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_establishments_prevent_same_day_reschedule 
ON establishments(prevent_same_day_reschedule);

-- 3. Verificar se o campo foi adicionado corretamente
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'establishments' 
  AND column_name = 'prevent_same_day_reschedule';

-- 4. Verificar se o índice foi criado
SELECT 
  indexname, 
  tablename, 
  indexdef
FROM pg_indexes 
WHERE tablename = 'establishments' 
  AND indexname = 'idx_establishments_prevent_same_day_reschedule';

-- 5. Testar se a tabela appointments tem os campos necessários para a validação
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'appointments' 
  AND column_name IN ('client_whatsapp', 'appointment_date', 'status', 'created_at')
ORDER BY column_name;

-- 6. Verificar se existem agendamentos cancelados para teste
SELECT 
  COUNT(*) as total_cancelled,
  COUNT(DISTINCT client_whatsapp) as unique_clients_cancelled
FROM appointments 
WHERE status = 'cancelled' 
  AND appointment_date >= CURRENT_DATE - INTERVAL '7 days';

-- 7. Mostrar alguns exemplos de agendamentos cancelados (últimos 7 dias)
SELECT 
  id,
  client_whatsapp,
  appointment_date,
  status,
  created_at
FROM appointments 
WHERE status = 'cancelled' 
  AND appointment_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 5;
