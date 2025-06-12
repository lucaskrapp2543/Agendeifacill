-- Migração: Sincronização em tempo real dos horários de funcionamento
-- Data: 2025-06-07
-- Descrição: Permite acesso público aos estabelecimentos e corrige estrutura de horários

-- 1. Permitir acesso público aos estabelecimentos para visualização
-- Remover políticas restritivas existentes
DROP POLICY IF EXISTS "Public can view establishment details" ON establishments;
DROP POLICY IF EXISTS "All users can view establishments" ON establishments;
DROP POLICY IF EXISTS "Owners can manage their establishments" ON establishments;

-- Criar nova política que permite acesso público (anônimo e autenticado) para leitura
CREATE POLICY "Public and authenticated can view establishments"
ON establishments
FOR SELECT
TO anon, authenticated
USING (true);

-- Manter política para proprietários gerenciarem seus estabelecimentos  
CREATE POLICY "Owners can manage their establishments"
ON establishments
FOR ALL
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- Conceder permissões explícitas para usuários anônimos lerem estabelecimentos
GRANT SELECT ON establishments TO anon;

-- 2. Corrigir estrutura de horários existentes (converter isOpen->enabled, start->open, end->close)
UPDATE establishments 
SET business_hours = jsonb_build_object(
  'monday', CASE 
    WHEN business_hours->'monday' IS NOT NULL THEN 
      jsonb_build_object(
        'enabled', COALESCE(business_hours->'monday'->>'isOpen', business_hours->'monday'->>'enabled')::boolean,
        'open', COALESCE(business_hours->'monday'->>'start', business_hours->'monday'->>'open'),
        'close', COALESCE(business_hours->'monday'->>'end', business_hours->'monday'->>'close')
      )
    ELSE jsonb_build_object('enabled', true, 'open', '08:00', 'close', '18:00')
  END,
  'tuesday', CASE 
    WHEN business_hours->'tuesday' IS NOT NULL THEN 
      jsonb_build_object(
        'enabled', COALESCE(business_hours->'tuesday'->>'isOpen', business_hours->'tuesday'->>'enabled')::boolean,
        'open', COALESCE(business_hours->'tuesday'->>'start', business_hours->'tuesday'->>'open'),
        'close', COALESCE(business_hours->'tuesday'->>'end', business_hours->'tuesday'->>'close')
      )
    ELSE jsonb_build_object('enabled', true, 'open', '08:00', 'close', '18:00')
  END,
  'wednesday', CASE 
    WHEN business_hours->'wednesday' IS NOT NULL THEN 
      jsonb_build_object(
        'enabled', COALESCE(business_hours->'wednesday'->>'isOpen', business_hours->'wednesday'->>'enabled')::boolean,
        'open', COALESCE(business_hours->'wednesday'->>'start', business_hours->'wednesday'->>'open'),
        'close', COALESCE(business_hours->'wednesday'->>'end', business_hours->'wednesday'->>'close')
      )
    ELSE jsonb_build_object('enabled', true, 'open', '08:00', 'close', '18:00')
  END,
  'thursday', CASE 
    WHEN business_hours->'thursday' IS NOT NULL THEN 
      jsonb_build_object(
        'enabled', COALESCE(business_hours->'thursday'->>'isOpen', business_hours->'thursday'->>'enabled')::boolean,
        'open', COALESCE(business_hours->'thursday'->>'start', business_hours->'thursday'->>'open'),
        'close', COALESCE(business_hours->'thursday'->>'end', business_hours->'thursday'->>'close')
      )
    ELSE jsonb_build_object('enabled', true, 'open', '08:00', 'close', '18:00')
  END,
  'friday', CASE 
    WHEN business_hours->'friday' IS NOT NULL THEN 
      jsonb_build_object(
        'enabled', COALESCE(business_hours->'friday'->>'isOpen', business_hours->'friday'->>'enabled')::boolean,
        'open', COALESCE(business_hours->'friday'->>'start', business_hours->'friday'->>'open'),
        'close', COALESCE(business_hours->'friday'->>'end', business_hours->'friday'->>'close')
      )
    ELSE jsonb_build_object('enabled', true, 'open', '08:00', 'close', '18:00')
  END,
  'saturday', CASE 
    WHEN business_hours->'saturday' IS NOT NULL THEN 
      jsonb_build_object(
        'enabled', COALESCE(business_hours->'saturday'->>'isOpen', business_hours->'saturday'->>'enabled')::boolean,
        'open', COALESCE(business_hours->'saturday'->>'start', business_hours->'saturday'->>'open'),
        'close', COALESCE(business_hours->'saturday'->>'end', business_hours->'saturday'->>'close')
      )
    ELSE jsonb_build_object('enabled', true, 'open', '08:00', 'close', '16:00')
  END,
  'sunday', CASE 
    WHEN business_hours->'sunday' IS NOT NULL THEN 
      jsonb_build_object(
        'enabled', COALESCE(business_hours->'sunday'->>'isOpen', business_hours->'sunday'->>'enabled')::boolean,
        'open', COALESCE(business_hours->'sunday'->>'start', business_hours->'sunday'->>'open'),
        'close', COALESCE(business_hours->'sunday'->>'end', business_hours->'sunday'->>'close')
      )
    ELSE jsonb_build_object('enabled', false, 'open', '00:00', 'close', '00:00')
  END
)
WHERE business_hours IS NOT NULL;

-- 3. Criar dados de teste se não existirem
INSERT INTO establishments (
    name, 
    description, 
    code, 
    owner_id, 
    services_with_prices, 
    professionals, 
    business_hours,
    profile_image_url,
    affiliate_link
) VALUES (
    'Rodrigo Barber',
    'Barbearia especializada em cortes masculinos e serviços de barbearia tradicional.',
    '1010',
    '00000000-0000-0000-0000-000000000000',
    ARRAY[
        '{"id": "1", "name": "Corte Masculino", "price": 25.00, "duration": 30}'::jsonb,
        '{"id": "2", "name": "Barba", "price": 15.00, "duration": 20}'::jsonb,
        '{"id": "3", "name": "Corte + Barba", "price": 35.00, "duration": 45}'::jsonb
    ],
    ARRAY[
        '{"id": "rodrigo", "name": "Rodrigo Silva"}'::jsonb,
        '{"id": "carlos", "name": "Carlos Santos"}'::jsonb
    ],
    '{"monday": {"enabled": true, "open": "08:00", "close": "18:00"}, "tuesday": {"enabled": true, "open": "08:00", "close": "18:00"}, "wednesday": {"enabled": true, "open": "08:00", "close": "18:00"}, "thursday": {"enabled": true, "open": "08:00", "close": "18:00"}, "friday": {"enabled": true, "open": "08:00", "close": "18:00"}, "saturday": {"enabled": true, "open": "08:00", "close": "16:00"}, "sunday": {"enabled": false, "open": "00:00", "close": "00:00"}}'::jsonb,
    null,
    null
) ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    services_with_prices = EXCLUDED.services_with_prices,
    professionals = EXCLUDED.professionals,
    business_hours = EXCLUDED.business_hours; 