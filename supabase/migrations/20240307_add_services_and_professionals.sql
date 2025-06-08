-- Adiciona campo services_with_prices JSONB na tabela establishments
ALTER TABLE establishments
ADD COLUMN IF NOT EXISTS services_with_prices JSONB DEFAULT '[]'::jsonb;

-- Adiciona campo professionals JSONB na tabela establishments
ALTER TABLE establishments
ADD COLUMN IF NOT EXISTS professionals JSONB DEFAULT '[]'::jsonb;

-- Atualiza a política de RLS para permitir o estabelecimento atualizar seus serviços e profissionais
DROP POLICY IF EXISTS "Establishment owners can update their own establishment" ON establishments;
CREATE POLICY "Establishment owners can update their own establishment"
ON establishments
FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- Atualiza a política de RLS para permitir os clientes verem os serviços e profissionais
DROP POLICY IF EXISTS "Public can view establishment details" ON establishments;
CREATE POLICY "Public can view establishment details"
ON establishments
FOR SELECT
TO authenticated
USING (true);

-- Adiciona índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_establishments_services ON establishments USING GIN (services_with_prices);
CREATE INDEX IF NOT EXISTS idx_establishments_professionals ON establishments USING GIN (professionals); 