-- Script para adicionar campo de limitação de agendamentos de assinantes
-- Execute este script no Supabase SQL Editor

-- Adicionar campo para limitar agendamentos de assinantes na tabela establishments
ALTER TABLE establishments 
ADD COLUMN IF NOT EXISTS limit_subscriber_bookings BOOLEAN DEFAULT false;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_establishments_limit_subscriber_bookings ON establishments(limit_subscriber_bookings);

-- Verificar se o campo foi adicionado corretamente
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'establishments' 
  AND column_name = 'limit_subscriber_bookings';

-- Mostrar alguns estabelecimentos com o novo campo
SELECT 
  id,
  name,
  code,
  limit_subscriber_bookings,
  created_at
FROM establishments 
LIMIT 5;
