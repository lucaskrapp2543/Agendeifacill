-- Script SQL para aplicar diretamente no Supabase Dashboard
-- Vai na aba "SQL Editor" do painel do Supabase e execute este código

-- 1. Permitir acesso público aos estabelecimentos para visualização
-- Isso resolve o erro 406 "Not Acceptable" que ocorre quando usuários não logados tentam acessar páginas de estabelecimentos

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

-- 2. Criar dados de teste se não existirem
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
    '{"monday": {"isOpen": true, "start": "08:00", "end": "18:00"}, "tuesday": {"isOpen": true, "start": "08:00", "end": "18:00"}, "wednesday": {"isOpen": true, "start": "08:00", "end": "18:00"}, "thursday": {"isOpen": true, "start": "08:00", "end": "18:00"}, "friday": {"isOpen": true, "start": "08:00", "end": "18:00"}, "saturday": {"isOpen": true, "start": "08:00", "end": "16:00"}, "sunday": {"isOpen": false, "start": "00:00", "end": "00:00"}}'::jsonb,
    null,
    null
) ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    services_with_prices = EXCLUDED.services_with_prices,
    professionals = EXCLUDED.professionals,
    business_hours = EXCLUDED.business_hours;

-- Verificar se deu certo
SELECT 'Políticas aplicadas com sucesso!' as status;
SELECT name, code FROM establishments WHERE code = '1010'; 